'use strict'

const { EventEmitter } = require('events')
const { watch } = require('fs/promises')
const { matchesGlob } = require('path')
const { PathOptionRequiredError } = require('./errors')

const ALLOWED_FS_EVENTS = ['change', 'rename']

function removeDotSlash (path) {
  return path.replace(/^\.[/\\]/, '')
}

class FileWatcher extends EventEmitter {
  constructor (opts) {
    super()

    if (typeof opts.path !== 'string') {
      throw new PathOptionRequiredError()
    }
    this.path = opts.path
    this.allowToWatch = opts.allowToWatch?.map(removeDotSlash) || null
    this.watchIgnore = opts.watchIgnore?.map(removeDotSlash) || null
    this.handlePromise = null
    this.abortController = null

    this.isWatching = false
  }

  startWatching () {
    if (this.isWatching) return
    this.isWatching = true

    this.abortController = new AbortController()
    const signal = this.abortController.signal

    // Recursive watch is unreliable on platforms besides macOS and Windows.
    // See: https://github.com/nodejs/node/issues/48437
    const fsWatcher = watch(this.path, {
      signal,
      recursive: true
    })

    let updateTimeout = null

    this.on('update', () => {
      clearTimeout(updateTimeout)
      updateTimeout = null
    })

    const eventHandler = async () => {
      for await (const { eventType, filename } of fsWatcher) {
        /* c8 ignore next */
        if (filename === null) return
        const isTimeoutSet = updateTimeout === null
        const isTrackedEvent = ALLOWED_FS_EVENTS.includes(eventType)
        const isTrackedFile = this.shouldFileBeWatched(filename)

        if (isTimeoutSet && isTrackedEvent && isTrackedFile) {
          updateTimeout = setTimeout(() => this.emit('update', filename), 100)
          updateTimeout.unref()
        }
      }
    } /* c8 ignore next */
    this.handlePromise = eventHandler()
  }

  async stopWatching () {
    if (!this.isWatching) return
    this.isWatching = false

    this.abortController.abort()
    await this.handlePromise.catch(() => {})
  }

  shouldFileBeWatched (fileName) {
    return this.isFileAllowed(fileName) && !this.isFileIgnored(fileName)
  }

  isFileAllowed (fileName) {
    if (this.allowToWatch === null) {
      return true
    }

    return this.allowToWatch.some(allowedFile => matchesGlob(fileName, allowedFile))
  }

  isFileIgnored (fileName) {
    // Always ignore the node_modules folder - This can be overriden by the allow list
    if (matchesGlob(fileName, 'node_modules/*') || matchesGlob(fileName, 'node_modules/**/*')) {
      return true
    }

    if (this.watchIgnore === null) {
      return false
    }

    for (const ignoredFile of this.watchIgnore) {
      if (matchesGlob(fileName, ignoredFile)) {
        return true
      }
    }

    return false
  }
}

module.exports = { FileWatcher }

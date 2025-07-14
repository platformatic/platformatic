import generateName from 'boring-name-generator'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { access, glob, mkdir, rm, watch } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, matchesGlob, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { PathOptionRequiredError } from './errors.js'

let tmpCount = 0
const ALLOWED_FS_EVENTS = ['change', 'rename']

export function removeDotSlash (path) {
  return path.replace(/^\.[/\\]/, '')
}

export function generateDashedName () {
  return generateName().dashed.replace(/\s+/g, '')
}

export async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

export async function createDirectory (path, empty = false) {
  if (empty) {
    await safeRemove(path)
  }

  return mkdir(path, { recursive: true, maxRetries: 10, retryDelay: 1000 })
}

export async function createTemporaryDirectory (prefix) {
  const directory = join(tmpdir(), `plt-utils-${prefix}-${process.pid}-${tmpCount++}`)

  return createDirectory(directory)
}

export async function safeRemove (path) {
  let i = 0
  while (i++ < 10) {
    if (!existsSync(path)) {
      return
    }

    /* c8 ignore start - Hard to test */
    try {
      await rm(path, { force: true, recursive: true })
      break
    } catch {
      // This means that we might not delete the folder at all.
      // This is ok as we can't really trust Windows to behave.
    }

    await sleep(1000)
    /* c8 ignore end - Hard to test */
  }
}

export async function searchFilesWithExtensions (root, extensions, globOptions = {}) {
  const globSuffix = Array.isArray(extensions) ? `{${extensions.join(',')}}` : extensions
  return Array.fromAsync(glob(`**/*.${globSuffix}`, { ...globOptions, cwd: root }))
}

export async function searchJavascriptFiles (projectDir, globOptions = {}) {
  return searchFilesWithExtensions(projectDir, ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'], {
    ...globOptions,
    ignore: ['node_modules', '**/node_modules/**']
  })
}

export async function hasFilesWithExtensions (root, extensions, globOptions = {}) {
  const files = await searchFilesWithExtensions(root, extensions, globOptions)
  return files.length > 0
}

export async function hasJavascriptFiles (projectDir, globOptions = {}) {
  const files = await searchJavascriptFiles(projectDir, globOptions)
  return files.length > 0
}

export class FileWatcher extends EventEmitter {
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

    if (this.allowToWatch) {
      this.allowToWatch = Array.from(new Set(this.allowToWatch))
    }

    if (this.watchIgnore) {
      this.watchIgnore = Array.from(new Set(this.watchIgnore))
    }

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
    if (fileName.startsWith('node_modules')) {
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

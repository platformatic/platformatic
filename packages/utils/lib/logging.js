'use strict'

const { isMainThread } = require('node:worker_threads')
const { getPrivateSymbol } = require('./symbols')

const applied = false

// This is a user-land implementation of https://github.com/nodejs/node/pull/56428
// TODO: Once this lands in all Node.js release lines, we need to detect them in order to skip it.
function ensureFlushedWorkerStdio () {
  if (isMainThread || applied) {
    return
  }

  // Fetch the needed symbols
  const kWritableCallbacks = getPrivateSymbol(process.stdout, 'kWritableCallbacks')
  // This has been fixed in Node.js 22.14.0
  if (kWritableCallbacks === undefined) {
    return
  }
  const kPort = getPrivateSymbol(process.stdout, 'kPort')
  const kName = getPrivateSymbol(process.stdout, 'kName')
  const kWaitingStreams = getPrivateSymbol(process.stdout[kPort], 'kWaitingStreams')
  const kStdioWantsMoreDataCallback = getPrivateSymbol(
    Object.getPrototypeOf(process.stdout),
    'kStdioWantsMoreDataCallback'
  )

  for (const stream of [process.stdout, process.stderr]) {
    stream._writev = function _writev (chunks, cb) {
      this[kPort].postMessage({
        type: 'stdioPayload',
        stream: this[kName],
        chunks: chunks.map(({ chunk, encoding }) => ({ chunk, encoding }))
      })

      if (process._exiting) {
        cb()
      } else {
        this[kWritableCallbacks].push(cb)
        if (this[kPort][kWaitingStreams]++ === 0) this[kPort].ref()
      }
    }
  }

  process.on('exit', function () {
    process.stdout[kStdioWantsMoreDataCallback]()
    process.stderr[kStdioWantsMoreDataCallback]()
  })
}

// This is needed so that pino detects a tampered stdout and avoid writing directly to the FD.
// Writing directly to the FD would bypass worker.stdout, which is currently piped in the parent process.
// See: https://github.com/pinojs/pino/blob/ad864b7ae02b314b9a548614f705a437e0db78c3/lib/tools.js#L330
function disablePinoDirectWrite () {
  process.stdout.write = process.stdout.write.bind(process.stdout)
}

module.exports = { disablePinoDirectWrite, ensureFlushedWorkerStdio }

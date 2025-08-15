'use strict'

const pprof = require('@datadog/pprof')
const runtime = require('@platformatic/runtime')
const { request } = require('undici')
const {
  ProfilingNotStartedError,
  NoProfileAvailableError,
  MissingUrlError,
  SendFlamegraphError
} = require('./lib/errors')

const kITC = runtime.symbols.kITC
const timeout = (parseInt(process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC) || 60) * 1000

let latestProfile = null
let isHandlerRegistered = false
let captureInterval = null
let isCapturing = false

// Store reference to any existing handlers that we might replace
let existingHandlers = null

function registerHandler () {
  if (!isHandlerRegistered && globalThis[kITC]) {
    isHandlerRegistered = true

    // Register new handlers - these will replace any existing ones
    globalThis[kITC].handle('sendFlamegraph', async (options) => {
      if (!isCapturing) {
        throw new ProfilingNotStartedError()
      }

      const { url, headers } = options
      if (!url) {
        throw new MissingUrlError()
      }

      if (latestProfile == null) {
        throw new NoProfileAvailableError()
      }

      const { statusCode, body } = await request(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream'
        },
        body: latestProfile.encode()
      })

      if (statusCode !== 200) {
        const errorText = await body.text()
        const error = new SendFlamegraphError(errorText)
        error.statusCode = statusCode
        throw error
      }
    })
  }
}

// Start capture loop
function startCapture () {
  if (isCapturing) return // Already capturing
  isCapturing = true

  async function captureAndReschedule () {
    // Register ITC handlers if ITC is set up
    registerHandler()

    try {
      latestProfile = await pprof.time.profile({ durationMillis: timeout })
    } catch (err) {
      // Log error but continue capturing
      if (globalThis.platformatic?.logger) {
        globalThis.platformatic.logger.error({ err }, 'Failed to capture profile')
      }
    }

    // Schedule next capture after current one completes
    // This prevents overlapping captures due to timer drift
    if (isCapturing) {
      captureInterval = setTimeout(captureAndReschedule, timeout)
      captureInterval.unref()
    }
  }

  if (!captureInterval) {
    // Start the first capture immediately
    captureAndReschedule()
  }
}

// Auto-start unless explicitly disabled
if (!process.env.PLT_DISABLE_FLAMEGRAPHS) {
  startCapture()
}

// Stop capture (for testing)
function stopCapture () {
  isCapturing = false
  if (captureInterval) {
    clearTimeout(captureInterval)
    captureInterval = null
  }
}

// Check if capturing is active
function isActive () {
  return isCapturing
}

// Export for testing purposes
module.exports = {
  startCapture,
  stopCapture,
  registerHandler,
  isActive
}

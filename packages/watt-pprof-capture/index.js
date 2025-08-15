'use strict'

const pprof = require('@datadog/pprof')
const {
  ProfilingNotStartedError,
  NoProfileAvailableError,
} = require('./lib/errors')
const { kITC } = require('../runtime/lib/worker/symbols')

const timeout = (parseInt(process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC) || 60) * 1000

let isCapturing = false // Flag to control capture state
let latestProfile = null
let isHandlerRegistered = false
let captureInterval = null
let registerTimeout = 10
let isProfilingInProgress = false // Flag to prevent concurrent pprof calls

function registerHandler () {
  if (isHandlerRegistered) {
    return true
  }

  // Use ITC for handler registration
  if (globalThis[kITC]) {
    globalThis[kITC].handle('getLastProfile', getLastProfile)
    globalThis[kITC].handle('startProfiling', startProfiling)
    globalThis[kITC].handle('stopProfiling', stopProfiling)
    isHandlerRegistered = true
    return true
  }

  // Keep trying until ITC is available
  setTimeout(registerHandler, registerTimeout)
  registerTimeout *= 1.2

  return false
}

async function startProfiling ({ timeout }) {
  // If already capturing, stop the current interval and restart with new timeout
  if (isCapturing && captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }

  isCapturing = true
  await updateProfile({ timeout })

  captureInterval = setInterval(updateProfile, timeout, { timeout })
  captureInterval.unref()
}

function stopProfiling () {
  isCapturing = false
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}

async function updateProfile ({ timeout }) {
  // Prevent concurrent profiling calls
  if (isProfilingInProgress) {
    return
  }

  try {
    isProfilingInProgress = true
    latestProfile = await pprof.time.profile({ durationMillis: timeout })
  } catch (err) {
    // Log error but continue capturing
    if (globalThis.platformatic?.logger) {
      globalThis.platformatic.logger.error({ err }, 'Failed to capture profile')
    }
  } finally {
    isProfilingInProgress = false
  }
}

function getLastProfile () {
  if (!isCapturing) {
    throw new ProfilingNotStartedError()
  }

  if (latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  const encoded = latestProfile.encode()
  // Convert Uint8Array to Buffer for better ITC compatibility
  return Buffer.from(encoded)
}

// Register handlers immediately
registerHandler()

if (!process.env.PLT_DISABLE_FLAMEGRAPHS) {
  startProfiling({ timeout })
}

module.exports = {
  startProfiling,
  stopProfiling
}

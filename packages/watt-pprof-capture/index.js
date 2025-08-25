'use strict'

const { setTimeout: sleep } = require('node:timers/promises')
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
    globalThis[kITC].handle('generateProfile', generateProfile)
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
  if (isProfilingInProgress) {
    isProfilingInProgress = false
    pprof.time.stop()
  }
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}

async function collectProfile ({ timeout }) {
  isProfilingInProgress = true

  let profile = null

  try {
    pprof.time.start()
    await sleep(timeout)

    // Check if profiling was not stopped while waiting
    if (isProfilingInProgress) {
      profile = pprof.time.stop()
    }
  } catch (err) {
    // Log error but continue capturing
    if (globalThis.platformatic?.logger) {
      globalThis.platformatic.logger.error({ err }, 'Failed to capture profile')
    }
  } finally {
    isProfilingInProgress = false
  }

  return profile
}

async function updateProfile ({ timeout }) {
  // Prevent concurrent profiling calls
  if (isProfilingInProgress) {
    return
  }
  latestProfile = await collectProfile({ timeout })
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

async function generateProfile ({ timeout }) {
  const wasCapturing = isCapturing
  if (isCapturing) {
    // Stop profiling with an interval.
    // CLI call has higher priority.
    stopProfiling()
  }

  let profile = null
  try {
    profile = await collectProfile({ timeout })
  } finally {
    if (wasCapturing) {
      // Restart profiling with an interval.
      startProfiling({ timeout })
    }
  }

  if (profile == null) {
    return null
  }

  const encoded = profile.encode()
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

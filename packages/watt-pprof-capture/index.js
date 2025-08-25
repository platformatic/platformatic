'use strict'

const { setTimeout: sleep } = require('node:timers/promises')
const pprof = require('@datadog/pprof')
const {
  ProfilingAlreadyStartedError,
  ProfilingNotStartedError,
  NoProfileAvailableError,
} = require('./lib/errors')

const kITC = Symbol.for('plt.runtime.itc')

let isCapturing = false
let isProfiling = false
let latestProfile = null
let latestTimeout = null
let captureInterval = null

// Keep trying until ITC is available. This is needed because preloads run
// before the app thread initialization, so globalThis.platformatic.messaging
// and ITC don't exist yet.
const registerInterval = setInterval(() => {
  if (globalThis[kITC]) {
    globalThis[kITC].handle('getLastProfile', getLastProfile)
    globalThis[kITC].handle('startProfiling', startProfiling)
    globalThis[kITC].handle('stopProfiling', stopProfiling)
    globalThis[kITC].handle('generateProfile', generateProfile)
    clearInterval(registerInterval)
  }
}, 10)

function rotateProfile () {
  // `true` immediately restarts profiling after stopping
  latestProfile = pprof.time.stop(true)
}

function startProfiling (options = {}) {
  if (isCapturing) {
    throw new ProfilingAlreadyStartedError()
  }

  isCapturing = true
  isProfiling = true

  pprof.time.start(options)

  // Set up profile window rotation if durationMillis is provided
  const timeout = options.durationMillis
  if (timeout) {
    captureInterval = setInterval(rotateProfile, timeout)
    captureInterval.unref()
    latestTimeout = timeout
  }
}

function stopProfiling () {
  if (!isCapturing) {
    throw new ProfilingNotStartedError()
  }
  isCapturing = false

  clearInterval(captureInterval)
  captureInterval = null

  if (isProfiling) {
    isProfiling = false
    latestProfile = pprof.time.stop()
    return latestProfile.encode()
  }
}

function getLastProfile () {
  // TODO: Should it be allowed to get last profile after stopping?
  if (!isCapturing) {
    throw new ProfilingNotStartedError()
  }

  if (latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  return latestProfile.encode()
}

async function generateProfile (options = {}) {
  const timeout = options.durationMillis

  const wasCapturing = isCapturing
  if (isCapturing) {
    stopProfiling()
  }

  let profile = null
  try {
    isProfiling = true

    pprof.time.start(options)
    await sleep(timeout)

    // Check if profiling was stopped in the meantime
    if (isProfiling) {
      profile = pprof.time.stop()
    }
  } finally {
    isProfiling = false

    if (wasCapturing) {
      startProfiling({ durationMillis: latestTimeout })
    }
  }

  return profile.encode()
}

module.exports = {
  startProfiling,
  stopProfiling,
  getLastProfile,
  generateProfile
}

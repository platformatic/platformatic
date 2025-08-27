'use strict'

const pprof = require('@datadog/pprof')
const {
  ProfilingAlreadyStartedError,
  ProfilingNotStartedError,
  ProfilingJobAlreadyStartedError,
  ProfilingJobNotStartedError,
  ProfilingJobAlreadyPausedError,
  ProfilingJobMissingOptionError,
  NoProfileAvailableError,
} = require('./lib/errors')

const kITC = Symbol.for('plt.runtime.itc')

let latestProfile = null

let isProfiling = false
let isProfilingJobStarted = false
let isProfilingJobPaused = false
let profilingJobOptions = null
let profilingJobInterval = null

// Keep trying until ITC is available. This is needed because preloads run
// before the app thread initialization, so globalThis.platformatic.messaging
// and ITC don't exist yet.
const registerInterval = setInterval(() => {
  if (globalThis[kITC]) {
    globalThis[kITC].handle('getLastProfile', getLastProfile)
    globalThis[kITC].handle('startProfilingJob', startProfilingJob)
    globalThis[kITC].handle('stopProfilingJob', stopProfilingJob)
    globalThis[kITC].handle('startProfiling', startProfiling)
    globalThis[kITC].handle('stopProfiling', stopProfiling)
    clearInterval(registerInterval)
  }
}, 10)

function startProfiling (options = {}) {
  if (isProfiling) {
    throw new ProfilingAlreadyStartedError()
  }
  isProfiling = true

  if (isProfilingJobStarted) {
    pauseProfilingJob()
  }

  try {
    pprof.time.start(options)
  } catch (err) {
    if (isProfilingJobPaused) {
      resumeProfilingJob()
    }
    isProfiling = false

    throw err
  }
}

function stopProfiling () {
  if (!isProfiling) {
    throw new ProfilingNotStartedError()
  }

  let profile = null

  try {
    profile = pprof.time.stop().encode()
  } finally {
    isProfiling = false

    if (isProfilingJobPaused) {
      resumeProfilingJob()
    }
  }

  return profile
}

function startProfilingJob (options = {}) {
  const timeout = options.durationMillis

  if (isProfilingJobStarted && !isProfilingJobPaused) {
    throw new ProfilingJobAlreadyStartedError()
  }

  if (timeout === undefined) {
    throw new ProfilingJobMissingOptionError('durationMillis')
  }

  isProfilingJobStarted = true
  profilingJobOptions = options

  if (isProfiling) {
    isProfilingJobPaused = true
    return
  }

  pprof.time.start(options)

  profilingJobInterval = setInterval(rotateProfile, timeout)
  profilingJobInterval.unref()
}

function rotateProfile () {
  // `true` immediately restarts profiling after stopping
  latestProfile = pprof.time.stop(true)
}

function stopProfilingJob () {
  if (!isProfilingJobStarted) {
    throw new ProfilingJobNotStartedError()
  }

  isProfilingJobStarted = false
  isProfilingJobPaused = false

  const profile = pprof.time.stop()
  const encoded = profile.encode()

  clearInterval(profilingJobInterval)
  profilingJobInterval = null

  return encoded
}

function pauseProfilingJob () {
  if (!isProfilingJobStarted) {
    throw new ProfilingJobNotStartedError()
  }
  if (isProfilingJobPaused) {
    throw new ProfilingJobAlreadyPausedError()
  }

  isProfilingJobPaused = true

  pprof.time.stop()

  clearInterval(profilingJobInterval)
  profilingJobInterval = null
}

function resumeProfilingJob () {
  if (!isProfilingJobStarted) {
    throw new ProfilingJobNotStartedError()
  }
  if (!isProfilingJobPaused) {
    throw new ProfilingJobAlreadyStartedError()
  }

  startProfilingJob(profilingJobOptions)
  isProfilingJobPaused = false
}

function getLastProfile () {
  // TODO: Should it be allowed to get last profile after stopping?
  if (!isProfilingJobStarted) {
    throw new ProfilingJobNotStartedError()
  }

  if (latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  return latestProfile.encode()
}

module.exports = {
  startProfilingJob,
  stopProfilingJob,
  startProfiling,
  stopProfiling,
  getLastProfile
}

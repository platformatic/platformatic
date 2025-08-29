import { time } from '@datadog/pprof'
import { NoProfileAvailableError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'

const kITC = Symbol.for('plt.runtime.itc')

let isCapturing = false
let latestProfile = null
let captureInterval = null

// Keep trying until ITC is available. This is needed because preloads run
// before the app thread initialization, so globalThis.platformatic.messaging
// and ITC don't exist yet.
const registerInterval = setInterval(() => {
  if (globalThis[kITC]) {
    globalThis[kITC].handle('getLastProfile', getLastProfile)
    globalThis[kITC].handle('startProfiling', startProfiling)
    globalThis[kITC].handle('stopProfiling', stopProfiling)
    clearInterval(registerInterval)
  }
}, 10)

function rotateProfile () {
  // `true` immediately restarts profiling after stopping
  latestProfile = time.stop(true)
}

export function startProfiling (options = {}) {
  if (isCapturing) {
    throw new ProfilingAlreadyStartedError()
  }
  isCapturing = true

  time.start(options)

  // Set up profile window rotation if durationMillis is provided
  const timeout = options.durationMillis
  if (timeout) {
    captureInterval = setInterval(rotateProfile, timeout)
    captureInterval.unref()
  }
}

export function stopProfiling () {
  if (!isCapturing) {
    throw new ProfilingNotStartedError()
  }
  isCapturing = false

  clearInterval(captureInterval)
  captureInterval = null

  latestProfile = time.stop()
  return latestProfile.encode()
}

export function getLastProfile () {
  // TODO: Should it be allowed to get last profile after stopping?
  if (!isCapturing) {
    throw new ProfilingNotStartedError()
  }

  if (latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  return latestProfile.encode()
}

export * as errors from './lib/errors.js'

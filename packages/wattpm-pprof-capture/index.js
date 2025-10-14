import { performance } from 'node:perf_hooks'
import { time, heap } from '@datadog/pprof'
import { NoProfileAvailableError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'

const { eventLoopUtilization } = performance
const kITC = Symbol.for('plt.runtime.itc')

const profilingState = {
  cpu: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    eluTimeout: null,
    options: null
  },
  heap: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    eluTimeout: null,
    options: null
  }
}

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

function getProfiler (type) {
  return type === 'heap' ? heap : time
}

function startProfiler (type, options) {
  const profiler = getProfiler(type)

  if (type === 'heap') {
    const intervalBytes = options.intervalBytes || 512 * 1024
    const stackDepth = options.stackDepth || 64
    profiler.start(intervalBytes, stackDepth)
  } else {
    profiler.start(options)
  }
}

function stopProfiler (type) {
  const state = profilingState[type]
  const profiler = getProfiler(type)

  if (type === 'heap') {
    state.latestProfile = profiler.profile()
    profiler.stop()
  } else {
    state.latestProfile = profiler.stop()
  }
}

function setupRotationInterval (type, options) {
  const state = profilingState[type]

  if (options.durationMillis) {
    state.captureInterval = setInterval(() => {
      if (!state.isCapturing) {
        return
      }

      stopProfiler(type)

      if (options.eluThreshold) {
        waitForELUAndStart(type, options)
      } else {
        startProfiler(type, options)
      }
    }, options.durationMillis)
    state.captureInterval.unref()
  }
}

function waitForELUAndStart (type, options) {
  const state = profilingState[type]

  if (state.eluTimeout) {
    clearTimeout(state.eluTimeout)
  }

  let previousELU = eventLoopUtilization()

  state.eluTimeout = setTimeout(() => {
    const currentELU = eventLoopUtilization(previousELU)

    if (currentELU.utilization >= options.eluThreshold) {
      state.eluTimeout = null
      startProfiler(type, options)
      state.isCapturing = true
    } else {
      previousELU = eventLoopUtilization()
      state.eluTimeout.refresh()
    }
  }, 1000)

  state.eluTimeout.unref()
  state.isCapturing = false
}

export function startProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (state.isCapturing || state.eluTimeout) {
    throw new ProfilingAlreadyStartedError()
  }

  state.options = options

  if (options.eluThreshold) {
    waitForELUAndStart(type, options)
    setupRotationInterval(type, options)
  } else {
    startProfiler(type, options)
    state.isCapturing = true
    setupRotationInterval(type, options)
  }
}

export function stopProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing && !state.eluTimeout) {
    throw new ProfilingNotStartedError()
  }

  if (state.captureInterval) {
    clearInterval(state.captureInterval)
    state.captureInterval = null
  }

  if (state.eluTimeout) {
    clearTimeout(state.eluTimeout)
    state.eluTimeout = null

    if (state.latestProfile) {
      return state.latestProfile.encode()
    }
    throw new NoProfileAvailableError()
  }

  stopProfiler(type)
  state.isCapturing = false
  state.options = null

  return state.latestProfile.encode()
}

export function getLastProfile (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing && !state.eluTimeout) {
    throw new ProfilingNotStartedError()
  }

  if (state.eluTimeout) {
    throw new NoProfileAvailableError()
  }

  const profiler = getProfiler(type)

  if (type === 'heap') {
    state.latestProfile = profiler.profile()
  } else if (!state.latestProfile) {
    throw new NoProfileAvailableError()
  }

  return state.latestProfile.encode()
}

export * as errors from './lib/errors.js'

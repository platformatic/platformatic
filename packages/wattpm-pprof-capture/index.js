import { time, heap } from '@datadog/pprof'
import { performance } from 'node:perf_hooks'
import { NoProfileAvailableError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'

const kITC = Symbol.for('plt.runtime.itc')

// Track profiling state separately for each type
const profilingState = {
  cpu: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    lastELU: null,
    eluThreshold: null,
    options: null
  },
  heap: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    lastELU: null,
    eluThreshold: null,
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
    // Heap profiler takes intervalBytes and stackDepth as positional arguments
    // Default: 512KB interval, 64 stack depth
    const intervalBytes = options.intervalBytes || 512 * 1024
    const stackDepth = options.stackDepth || 64
    profiler.start(intervalBytes, stackDepth)
  } else {
    // CPU time profiler takes options object
    profiler.start(options)
  }
}

function stopProfiler (type, state) {
  const profiler = getProfiler(type)

  if (type === 'heap') {
    // Get the profile before stopping
    state.latestProfile = profiler.profile()
    profiler.stop()
  } else {
    // CPU time profiler returns the profile when stopping
    state.latestProfile = profiler.stop()
  }
}

function isAboveThreshold (state) {
  return state.lastELU != null && state.lastELU > state.eluThreshold
}

function isProfilerRunning (state) {
  // If no threshold: always running
  // If threshold: only running if lastELU is above threshold
  return state.eluThreshold == null || isAboveThreshold(state)
}

function rotateProfile (type) {
  const profiler = getProfiler(type)
  const state = profilingState[type]

  // Check ELU and adjust profiling if threshold is set
  if (state.eluThreshold != null) {
    const elu = performance.eventLoopUtilization()
    const currentELU = elu.utilization

    const wasAbove = isAboveThreshold(state)
    const isAbove = currentELU > state.eluThreshold

    if (!wasAbove && isAbove) {
      // Start profiling when crossing above threshold
      startProfiler(type, state.options)
    } else if (wasAbove && currentELU < state.eluThreshold - 0.1) {
      // Stop profiling when dropping below threshold minus hysteresis
      stopProfiler(type, state)
    }

    state.lastELU = currentELU
  }

  // Only rotate if actually profiling
  if (!isProfilerRunning(state)) return

  if (type === 'heap') {
    // Heap profiler needs to call profile() to get the current profile
    state.latestProfile = profiler.profile()
  } else {
    // CPU time profiler: `true` immediately restarts profiling after stopping
    state.latestProfile = profiler.stop(true)
  }
}

export function startProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (state.isCapturing) {
    throw new ProfilingAlreadyStartedError()
  }
  state.isCapturing = true
  state.options = options
  state.eluThreshold = options.eluThreshold

  // Always start profiling immediately
  startProfiler(type, options)

  // Set up profile window rotation if durationMillis is provided
  const timeout = options.durationMillis
  if (timeout) {
    // Initialize lastELU above threshold so rotateProfile knows profiler is running
    if (options.eluThreshold != null) {
      state.lastELU = options.eluThreshold + 0.1
    }
    state.captureInterval = setInterval(() => rotateProfile(type), timeout)
    state.captureInterval.unref()
  }
}

export function stopProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing) {
    throw new ProfilingNotStartedError()
  }
  state.isCapturing = false

  clearInterval(state.captureInterval)
  state.captureInterval = null

  // If the profiler is actually running, stop it and get the profile
  if (isProfilerRunning(state)) {
    stopProfiler(type, state)
  }

  // Clean up state
  state.lastELU = null
  state.eluThreshold = null
  state.options = null

  // latestProfile should always exist since we start profiling immediately
  // and capture a profile when stopping (either here or in rotateProfile)
  if (!state.latestProfile) {
    throw new NoProfileAvailableError()
  }

  return state.latestProfile.encode()
}

export function getLastProfile (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  // TODO: Should it be allowed to get last profile after stopping?
  if (!state.isCapturing) {
    throw new ProfilingNotStartedError()
  }

  // For heap profiler, always get the current profile (if actually profiling)
  // For CPU profiler, use the cached profile if available
  if (type === 'heap') {
    if (isProfilerRunning(state)) {
      const profiler = getProfiler(type)
      state.latestProfile = profiler.profile()
    } else if (state.latestProfile == null) {
      throw new NoProfileAvailableError()
    }
  } else if (state.latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  return state.latestProfile.encode()
}

export * as errors from './lib/errors.js'

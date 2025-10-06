import { time, heap } from '@datadog/pprof'
import { NoProfileAvailableError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'

const kITC = Symbol.for('plt.runtime.itc')

// Track profiling state separately for each type
const profilingState = {
  cpu: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null
  },
  heap: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null
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

function rotateProfile (type) {
  const profiler = getProfiler(type)
  const state = profilingState[type]

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

  const profiler = getProfiler(type)

  // Heap profiler has different API than time profiler
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

  // Set up profile window rotation if durationMillis is provided
  const timeout = options.durationMillis
  if (timeout) {
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

  const profiler = getProfiler(type)

  // Heap and CPU profilers have different stop APIs
  if (type === 'heap') {
    // Get the profile before stopping
    state.latestProfile = profiler.profile()
    profiler.stop()
  } else {
    // CPU time profiler returns the profile when stopping
    state.latestProfile = profiler.stop()
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

  const profiler = getProfiler(type)

  // For heap profiler, always get the current profile
  // For CPU profiler, use the cached profile if available
  if (type === 'heap') {
    state.latestProfile = profiler.profile()
  } else if (state.latestProfile == null) {
    throw new NoProfileAvailableError()
  }

  return state.latestProfile.encode()
}

export * as errors from './lib/errors.js'

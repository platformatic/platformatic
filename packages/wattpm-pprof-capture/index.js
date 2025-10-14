import { time, heap } from '@datadog/pprof'
import { performance } from 'node:perf_hooks'
import { NoProfileAvailableError, NotEnoughELUError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'

const kITC = Symbol.for('plt.runtime.itc')

// Track ELU globally (shared across all profiler types)
let lastELU = performance.eventLoopUtilization()

// Start continuous ELU tracking immediately
const eluUpdateInterval = setInterval(() => {
  lastELU = performance.eventLoopUtilization(lastELU)

  for (const type of ['cpu', 'heap']) {
    const state = profilingState[type]
    startIfOverThreshold(type, state)
  }
}, 1000)
eluUpdateInterval.unref()

// Track profiling state separately for each type
const profilingState = {
  cpu: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    durationMillis: null,
    eluThreshold: null,
    options: null,
    profilerStarted: false,
    clearProfileTimeout: null
  },
  heap: {
    isCapturing: false,
    latestProfile: null,
    captureInterval: null,
    durationMillis: null,
    eluThreshold: null,
    options: null,
    profilerStarted: false,
    clearProfileTimeout: null
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
    globalThis[kITC].handle('getProfilingState', getProfilingState)
    clearInterval(registerInterval)
  }
}, 10)

function getProfiler (type) {
  return type === 'heap' ? heap : time
}

function scheduleLastProfileCleanup (state) {
  unscheduleLastProfileCleanup(state)

  // Set up timer to clear profile after rotation duration
  if (state.options?.durationMillis) {
    state.clearProfileTimeout = setTimeout(() => {
      state.latestProfile = undefined
      state.clearProfileTimeout = null
    }, state.options.durationMillis)
    state.clearProfileTimeout.unref()
  }
}

function unscheduleLastProfileCleanup (state) {
  // Clear any pending profile clear timeout
  if (state.clearProfileTimeout) {
    clearTimeout(state.clearProfileTimeout)
    state.clearProfileTimeout = null
  }
}

function scheduleProfileRotation (type, state, options) {
  unscheduleProfileRotation(state)

  // Set up profile window rotation if durationMillis is provided
  if (options.durationMillis) {
    state.captureInterval = setInterval(() => rotateProfile(type), options.durationMillis)
    state.captureInterval.unref()
  }
}

function unscheduleProfileRotation (state) {
  if (!state.captureInterval) return
  clearInterval(state.captureInterval)
  state.captureInterval = null
}

function startProfiler (type, state, options) {
  if (state.profilerStarted) return

  const profiler = getProfiler(type)

  unscheduleLastProfileCleanup(state)
  scheduleProfileRotation(type, state, options)
  state.profilerStarted = true

  if (type === 'heap') {
    // Heap profiler takes intervalBytes and stackDepth as positional arguments
    // Default: 512KB interval, 64 stack depth
    const intervalBytes = options.intervalBytes || 512 * 1024
    const stackDepth = options.stackDepth || 64
    profiler.start(intervalBytes, stackDepth)
  } else {
    // CPU time profiler takes options object
    options.intervalMicros ??= 33333
    profiler.start(options)
  }
}

function stopProfiler (type, state) {
  if (!state.profilerStarted) return

  const profiler = getProfiler(type)

  scheduleLastProfileCleanup(state)
  unscheduleProfileRotation(state)
  state.profilerStarted = false

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
  return lastELU != null && lastELU.utilization > state.eluThreshold
}

function isBelowStopThreshold (state) {
  // Use hysteresis: stop at threshold - 0.1 to prevent rapid toggling
  const stopThreshold = state.eluThreshold - 0.1
  return lastELU != null && lastELU.utilization < stopThreshold
}

function rotateProfile (type) {
  const state = profilingState[type]

  stopProfiler(type, state)
  maybeStartProfiler(type, state)
}

function maybeStartProfiler (type, state) {
  // Check if we should start profiling based on current ELU (updated by global interval)
  if (state.eluThreshold != null) {
    startIfOverThreshold(type, state)
  } else if (state.isCapturing) {
    // No threshold, always start profiling
    startProfiler(type, state, state.options)
  }
}

function startIfOverThreshold (type, state) {
  // Only check if profiling is active and has an ELU threshold
  if (!state.isCapturing || state.eluThreshold == null) {
    return
  }

  const wasRunning = state.profilerStarted
  const currentELU = lastELU?.utilization

  // Hysteresis logic:
  // - Start if ELU > threshold
  // - Stop if ELU < threshold - 0.1
  // - Between thresholds: maintain current state
  const shouldRun = wasRunning
    // Was running: only stop if ELU drops below stop threshold
    ? !isBelowStopThreshold(state)
    // Was not running: only start if ELU rises above start threshold
    : isAboveThreshold(state)

  if (shouldRun) {
    // ELU is high enough, start/restart profiling
    if (!wasRunning && globalThis.platformatic?.logger) {
      globalThis.platformatic.logger.info(
        { type, eluThreshold: state.eluThreshold, currentELU },
        'Starting profiler due to ELU threshold exceeded'
      )
    }
    startProfiler(type, state, state.options)
  } else {
    // ELU is too low, don't restart profiler
    if (wasRunning && globalThis.platformatic?.logger) {
      globalThis.platformatic.logger.info(
        { type, eluThreshold: state.eluThreshold, currentELU },
        'Pausing profiler due to ELU below threshold'
      )
    }
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
  state.durationMillis = options.durationMillis

  maybeStartProfiler(type, state)
}

export function stopProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing) {
    throw new ProfilingNotStartedError()
  }
  state.isCapturing = false

  stopProfiler(type, state)

  // Clean up state
  state.eluThreshold = null
  state.durationMillis = null
  state.options = null

  // Clear the profile clear timeout if it exists
  unscheduleLastProfileCleanup(state)

  // Return the latest profile if available, otherwise return an empty profile
  // (e.g., when profiler never started due to ELU threshold not being exceeded)
  if (state.latestProfile) {
    return state.latestProfile.encode()
  } else {
    return new Uint8Array(0)
  }
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
  if (type === 'heap' && state.profilerStarted) {
    const profiler = getProfiler(type)
    state.latestProfile = profiler.profile()
  }

  // Check if we have a profile
  if (state.latestProfile == null) {
    // No profile available
    if (state.profilerStarted) {
      // Profiler is running but no profile yet (waiting for first rotation)
      throw new NoProfileAvailableError()
    } else {
      // Profiler is not running (paused due to low ELU or never started)
      throw new NotEnoughELUError()
    }
  }

  return state.latestProfile.encode()
}

export function getProfilingState (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  return {
    isCapturing: state.isCapturing,
    hasProfile: state.latestProfile != null,
    isProfilerRunning: state.profilerStarted,
    isPausedBelowThreshold: state.eluThreshold != null && !state.profilerStarted,
    lastELU: lastELU?.utilization,
    eluThreshold: state.eluThreshold
  }
}

export * as errors from './lib/errors.js'

import { heap, SourceMapper, time } from '@datadog/pprof'
import { getITC, getLogger } from '@platformatic/globals'
import { workerData } from 'node:worker_threads'
import { NoProfileAvailableError, NotEnoughELUError, ProfilingAlreadyStartedError, ProfilingNotStartedError } from './lib/errors.js'
import { SourceMapperWrapper } from './lib/source-mapper-wrapper.js'

// @datadog/pprof >= 5.14.2 introduced a regression in the legacy time profiler
// `stop()`: it now clears the internal source mapper (via handleStopNoRestart)
// *before* serializing the profile, so transpiled frames (e.g. TypeScript) are
// no longer mapped back to their original `.ts` sources. The `stopV2()` entry
// point serializes the profile while the source mapper is still set — the
// behaviour `stop()` had in earlier versions. It is not re-exported on the
// public `time` facade, so resolve it from the internal module when available
// and fall back to the public `stop()` otherwise (e.g. older versions).
let stopTimeProfilerV2 = null
try {
  ;({ stopV2: stopTimeProfilerV2 } = await import('@datadog/pprof/out/src/time-profiler.js'))
} catch {
  // Internal module path not available; fall back to the public stop().
}

// SourceMapper for resolving transpiled code locations back to original source
let sourceMapper = null
let sourceMapperInitialized = false

// Track profiling state separately for each type. When an ELU threshold is
// set the profiler is driven by the runtime main thread: its health metrics
// cycle measures this worker's event loop utilization (without depending on
// this thread's event loop being responsive) and toggles the profiler via the
// resumeProfiling/pauseProfiling commands. The `paused` flag tracks whether
// the profiler is currently gated off.
const profilingState = {
  cpu: {
    isCapturing: false,
    latestProfile: null,
    latestProfileTimestamp: null,
    captureInterval: null,
    durationMillis: null,
    eluThreshold: null,
    paused: false,
    pauseReason: null,
    options: null,
    profilerStarted: false,
    clearProfileTimeout: null,
    sourceMapsEnabled: false
  },
  heap: {
    isCapturing: false,
    latestProfile: null,
    latestProfileTimestamp: null,
    captureInterval: null,
    durationMillis: null,
    eluThreshold: null,
    paused: false,
    pauseReason: null,
    options: null,
    profilerStarted: false,
    clearProfileTimeout: null,
    sourceMapsEnabled: false
  }
}

// Keep trying until ITC is available. This is needed because preloads run
// before the app thread initialization, so messaging and ITC don't exist yet.
const registerInterval = setInterval(() => {
  const itc = getITC({ throwOnMissing: false })

  if (itc) {
    itc.handle('getLastProfile', getLastProfile)
    itc.handle('startProfiling', startProfiling)
    itc.handle('stopProfiling', stopProfiling)
    itc.handle('getProfilingState', getProfilingState)
    itc.handle('resumeProfiling', resumeProfiling)
    itc.handle('pauseProfiling', pauseProfiling)

    // The runtime main thread drives the ELU gating as part of its health
    // metrics cycle and toggles the profiler with fire-and-forget
    // notifications.
    itc.on('resumeProfiling', resumeProfiling)
    itc.on('pauseProfiling', pauseProfiling)

    clearInterval(registerInterval)
  }
}, 10)

function getProfiler (type) {
  return type === 'heap' ? heap : time
}

function serializeProfile (profile, options) {
  // Return the latest profile if available, otherwise return an empty profile
  // (e.g., when profiler never started due to ELU threshold not being exceeded)
  const encodedProfile = profile ? profile.encode() : new Uint8Array(0)

  if (options.includeSampleCount) {
    return {
      profile: encodedProfile,
      sampleCount: profile?.sample.length ?? 0
    }
  }

  return encodedProfile
}

function scheduleLastProfileCleanup (state) {
  unscheduleLastProfileCleanup(state)

  // Set up timer to clear profile after rotation duration
  if (state.options?.durationMillis) {
    state.clearProfileTimeout = setTimeout(() => {
      state.latestProfile = undefined
      state.latestProfileTimestamp = null
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
  if (state.profilerStarted) {
    return
  }

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
    const profilerOptions = { ...options }
    profilerOptions.intervalMicros ??= 33333

    // Enable line numbers to get file information in the profile
    profilerOptions.lineNumbers = true

    // Add sourceMapper if enabled and available for transpiled source resolution
    if (state.sourceMapsEnabled && sourceMapper) {
      profilerOptions.sourceMapper = sourceMapper
    }

    profiler.start(profilerOptions)
  }
}

function stopProfiler (type, state) {
  if (!state.profilerStarted) return

  const profiler = getProfiler(type)

  scheduleLastProfileCleanup(state)
  unscheduleProfileRotation(state)
  state.profilerStarted = false
  state.latestProfileTimestamp = Date.now()

  if (type === 'heap') {
    // Get the profile before stopping
    // Pass sourceMapper if enabled and available for transpiled source resolution
    state.latestProfile = (state.sourceMapsEnabled && sourceMapper) ? profiler.profile(undefined, sourceMapper) : profiler.profile()
    profiler.stop()
  } else {
    // CPU time profiler returns the profile when stopping.
    // sourceMapper was already passed to start(), so it's applied automatically.
    // Use stopV2() when available so the source mapper is honoured during
    // serialization (see the note next to stopTimeProfilerV2 above).
    state.latestProfile = stopTimeProfilerV2 ? stopTimeProfilerV2() : profiler.stop()
  }
}

function rotateProfile (type) {
  const state = profilingState[type]
  const wasRunning = state.profilerStarted

  stopProfiler(type, state)

  if (wasRunning && state.latestProfile) {
    notifyProfileCaptured(type, state)
  }

  // A pending pause takes effect here: the completed window was captured and
  // announced above, and maybeStartProfiler leaves the profiler stopped.
  maybeStartProfiler(type, state)
  handleOverloadPause(type, state)
}

function notifyMainThread (name, payload) {
  const itc = getITC({ throwOnMissing: false })

  if (!itc) {
    return
  }

  try {
    itc.notify(name, payload)
  } catch (err) {
    getLogger({ throwOnMissing: false })?.error({ err, name }, 'Failed to notify the main thread')
  }
}

// Notify the main thread that the continuous profiler completed a profile
// window. The profile itself is purposely not included as it can be big and
// there might be no consumer: interested code can retrieve it on demand via
// the getLastProfile command.
function notifyProfileCaptured (type, state) {
  notifyMainThread('profile:captured', {
    type,
    timestamp: state.latestProfileTimestamp,
    sampleCount: state.latestProfile.sample.length
  })
}

function maybeStartProfiler (type, state) {
  if (state.isCapturing && !state.paused) {
    startProfiler(type, state, state.options)
  }
}

// When the pause is due to the worker being overloaded, the final profile is
// the evidence of what saturated the worker: keep it available for the whole
// pause (consumers may retrieve it at any point during the overload) and push
// an encoded copy to the main thread, so that it survives even if this worker
// becomes unresponsive or is replaced by the health checks before anyone
// pulls it. This is the only case where the profile payload crosses the
// thread boundary unrequested, and it is bounded to one profile per overload
// episode. Below-threshold pauses keep the regular expiry so that a stale
// profile is not mistaken for a recent one.
function handleOverloadPause (type, state) {
  if (!state.paused || state.pauseReason !== 'overload') {
    return
  }

  unscheduleLastProfileCleanup(state)

  if (!state.latestProfile) {
    return
  }

  try {
    notifyMainThread('profile:overload', {
      type,
      timestamp: state.latestProfileTimestamp,
      profile: state.latestProfile.encode(),
      sampleCount: state.latestProfile.sample.length
    })
  } catch (err) {
    getLogger({ throwOnMissing: false })?.error({ err, type }, 'Failed to preserve the overload profile')
  }
}

// Invoked by the runtime main thread when the worker ELU rises above the
// configured threshold. If a pending pause had not been applied yet (the
// current window is still recording), it is simply cancelled.
export function resumeProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing || !state.paused) {
    return
  }

  state.paused = false
  state.pauseReason = null
  getLogger({ throwOnMissing: false })?.debug({ type, eluThreshold: state.eluThreshold }, 'Resuming profiler')
  startProfiler(type, state, state.options)
}

// Invoked by the runtime main thread when the worker ELU drops below the
// configured threshold or exceeds the maxELU overload cutoff. The pause takes
// effect at the next rotation boundary, so that the current window completes
// its full duration before being captured and announced like any other
// rotation. Without rotation the profiler is stopped immediately.
export function pauseProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (!state.isCapturing || state.paused) {
    return
  }

  state.paused = true
  state.pauseReason = options.reason ?? null
  getLogger({ throwOnMissing: false })?.debug(
    { type, eluThreshold: state.eluThreshold, reason: options.reason },
    'Pausing profiler'
  )

  if (state.profilerStarted && !state.captureInterval) {
    stopProfiler(type, state)

    if (state.latestProfile) {
      notifyProfileCaptured(type, state)
    }

    handleOverloadPause(type, state)
  }
}

async function initializeSourceMapper (options = {}) {
  if (sourceMapperInitialized) {
    return
  }

  sourceMapperInitialized = true

  try {
    // Get the application directory from workerData
    const appPath = workerData?.applicationConfig?.path
    if (!appPath) {
      const logger = getLogger({ throwOnMissing: false })
      if (logger) {
        logger.debug('No application path available for sourcemap resolution')
      }
      return
    }

    // Create SourceMapper to search for .map files in the app directory
    // Note: SourceMapper searches recursively for files matching /\.[cm]?js\.map$/
    const debug = process.env.PLT_PPROF_SOURCEMAP_DEBUG === 'true'
    const innerMapper = await SourceMapper.create([appPath], debug)

    // Load additional node_modules sourcemaps if specified
    if (options.nodeModulesSourceMaps?.length > 0) {
      const { loadNodeModulesSourceMaps } = await import('./lib/node-modules-sourcemaps.js')
      const moduleEntries = await loadNodeModulesSourceMaps(
        appPath,
        options.nodeModulesSourceMaps,
        debug
      )
      for (const [generatedPath, info] of moduleEntries) {
        innerMapper.infoMap.set(generatedPath, info)
      }
    }

    // Wrap the SourceMapper to fix Windows path normalization
    sourceMapper = new SourceMapperWrapper(innerMapper)

    const logger = getLogger({ throwOnMissing: false })
    if (logger) {
      const hasMappings = sourceMapper && typeof sourceMapper.hasMappingInfo === 'function'
      logger.info(
        { appPath, hasSourceMapper: !!sourceMapper, hasMappingInfo: hasMappings },
        'SourceMapper initialized for profiling'
      )
    }
  } catch (err) {
    const logger = getLogger({ throwOnMissing: false })
    if (logger) {
      logger.warn(
        { err: err.message, stack: err.stack },
        'Failed to initialize SourceMapper'
      )
    }
  }
}

export async function startProfiling (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  if (state.isCapturing) {
    throw new ProfilingAlreadyStartedError()
  }

  // Initialize source mapper if source maps are requested
  if (options.sourceMaps === undefined) {
    state.sourceMapsEnabled = process.sourceMapsEnabled
  } else if (options.sourceMaps === true) {
    state.sourceMapsEnabled = true
  }

  if (state.sourceMapsEnabled) {
    await initializeSourceMapper({
      nodeModulesSourceMaps: options.nodeModulesSourceMaps
    })
  }

  state.isCapturing = true
  state.options = options
  state.eluThreshold = options.eluThreshold
  state.durationMillis = options.durationMillis

  // Register the gating needs with the runtime main thread, which measures
  // the worker ELU as part of its health metrics cycle: profiling only runs
  // while the ELU is above the eluThreshold demand (if set) and below the
  // maxELU overload cutoff (which defaults to the worker health.maxELU and
  // can be overridden or disabled via the maxELU option).
  const wantsGating =
    options.eluThreshold != null ||
    typeof options.maxELU === 'number' ||
    (options.durationMillis != null && options.maxELU !== false)

  const driven = wantsGating && (await registerProfilingGate(type, options))

  // When an ELU threshold is set and the main thread drives the gating, the
  // profiler starts paused: the runtime resumes it once it measures an ELU
  // above the threshold. Without a driver the profiler runs ungated.
  state.paused = driven && options.eluThreshold != null

  maybeStartProfiler(type, state)
}

// Gate registration is a request on purpose: a runtime without the
// main-thread driver rejects it with PLT_ITC_HANDLER_NOT_FOUND, and the
// profiler falls back to running ungated — with more overhead than the
// caller asked for, but working, instead of starting paused forever waiting
// for a resume that would never come. The same applies when the module is
// used outside a Platformatic runtime.
async function registerProfilingGate (type, options) {
  const itc = getITC({ throwOnMissing: false })

  if (!itc) {
    return false
  }

  try {
    await itc.send('profiling:started', {
      type,
      eluThreshold: options.eluThreshold ?? null,
      maxELU: options.maxELU ?? null,
      continuous: options.durationMillis != null
    })

    return true
  } catch (err) {
    const logger = getLogger({ throwOnMissing: false })

    if (err?.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
      logger?.warn(
        { type },
        'The runtime does not support main-thread profiler gating: eluThreshold and maxELU are ignored and the profiler runs ungated. Upgrade @platformatic/runtime.'
      )
    } else {
      logger?.error({ err, type }, 'Failed to register the profiler gate, the profiler runs ungated')
    }

    return false
  }
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
  state.paused = false
  state.options = null
  state.sourceMapsEnabled = false

  notifyMainThread('profiling:stopped', { type })

  return serializeProfile(state.latestProfile, options)
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
    // Get heap profile with sourceMapper if enabled and available
    state.latestProfile = (state.sourceMapsEnabled && sourceMapper) ? profiler.profile(undefined, sourceMapper) : profiler.profile()
    state.latestProfileTimestamp = Date.now()
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

  const result = serializeProfile(state.latestProfile, options)

  // Return metadata alongside the profile when requested. Pairing the
  // timestamp with the profile avoids a race across rotations, while the
  // sample count lets callers reject metadata-only protobufs without decoding
  // them. The raw profile remains the default for backward compatibility.
  if (options.includeTimestamp) {
    return {
      ...(options.includeSampleCount ? result : { profile: result }),
      timestamp: state.latestProfileTimestamp
    }
  }

  return result
}

export function getProfilingState (options = {}) {
  const type = options.type || 'cpu'
  const state = profilingState[type]

  return {
    isCapturing: state.isCapturing,
    hasProfile: state.latestProfile != null,
    isProfilerRunning: state.profilerStarted,
    isPaused: state.paused,
    isPausedBelowThreshold: state.eluThreshold != null && state.paused,
    eluThreshold: state.eluThreshold,
    latestProfileTimestamp: state.latestProfileTimestamp
  }
}

export * as errors from './lib/errors.js'

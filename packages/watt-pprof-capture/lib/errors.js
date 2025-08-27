'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_PPROF'

const ProfilingAlreadyStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_ALREADY_STARTED`,
  'Profiling is already started'
)

const ProfilingNotStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_NOT_STARTED`,
  'Profiling not started - call startProfiling() first'
)

const ProfilingJobAlreadyStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_JOB_ALREADY_STARTED`,
  'Profiling job is already started'
)

const ProfilingJobNotStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_JOB_NOT_STARTED`,
  'Profiling job not started - call startProfilingJob() first'
)

const ProfilingJobAlreadyPausedError = createError(
  `${ERROR_PREFIX}_PROFILING_JOB_ALREADY_PAUSED`,
  'Profiling job is already paused'
)

const ProfilingJobMissingOptionError = createError(
  `${ERROR_PREFIX}_PROFILING_JOB_MISSING_OPTION`,
  'Profiling job "%s" option is missing'
)

const NoProfileAvailableError = createError(
  `${ERROR_PREFIX}_NO_PROFILE_AVAILABLE`,
  'No profile available - wait for profiling to complete or trigger manual capture'
)

module.exports = {
  ProfilingAlreadyStartedError,
  ProfilingNotStartedError,
  ProfilingJobAlreadyStartedError,
  ProfilingJobNotStartedError,
  ProfilingJobAlreadyPausedError,
  ProfilingJobMissingOptionError,
  NoProfileAvailableError,
}

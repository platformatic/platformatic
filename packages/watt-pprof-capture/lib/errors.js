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

const NoProfileAvailableError = createError(
  `${ERROR_PREFIX}_NO_PROFILE_AVAILABLE`,
  'No profile available - wait for profiling to complete or trigger manual capture'
)

const ManualProfilingIsAlreadyStartedError = createError(
  `${ERROR_PREFIX}_MANUAL_PROFILING_IS_ALREADY_STARTED`,
  'Manual profiling is already started'
)

module.exports = {
  ProfilingAlreadyStartedError,
  ProfilingNotStartedError,
  NoProfileAvailableError,
  ManualProfilingIsAlreadyStartedError
}

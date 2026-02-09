import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_PPROF'

export const ProfilingAlreadyStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_ALREADY_STARTED`,
  'Profiling is already started',
  400
)

export const ProfilingNotStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_NOT_STARTED`,
  'Profiling not started - call startProfiling() first',
  400
)

export const NoProfileAvailableError = createError(
  `${ERROR_PREFIX}_NO_PROFILE_AVAILABLE`,
  'No profile available - wait for profiling to complete or trigger manual capture',
  400
)

export const NotEnoughELUError = createError(
  `${ERROR_PREFIX}_NOT_ENOUGH_ELU`,
  'No profile available - event loop utilization has been below threshold for too long',
  400
)

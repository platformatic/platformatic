'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_PPROF'

const ProfilingNotStartedError = createError(
  `${ERROR_PREFIX}_PROFILING_NOT_STARTED`,
  'Profiling not started - set PLT_DISABLE_FLAMEGRAPHS=false or call startCapture()'
)

const NoProfileAvailableError = createError(
  `${ERROR_PREFIX}_NO_PROFILE_AVAILABLE`,
  'No profile available - wait for profiling to complete or trigger manual capture'
)

module.exports = {
  ProfilingNotStartedError,
  NoProfileAvailableError
}

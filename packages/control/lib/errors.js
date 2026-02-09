import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_CTR'

export const RuntimeNotFound = createError(`${ERROR_PREFIX}_RUNTIME_NOT_FOUND`, 'Runtime not found.')

export const ApplicationNotFound = createError(`${ERROR_PREFIX}_APPLICATION_NOT_FOUND`, 'Application not found.')

export const MissingRequestURL = createError(`${ERROR_PREFIX}_MISSING_REQUEST_URL`, 'Request URL is required.')

export const FailedToGetRuntimeMetadata = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METADATA`,
  'Failed to get runtime metadata %s.'
)

export const FailedToGetRuntimeApplications = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_APPLICATIONS`,
  'Failed to get runtime applications %s.'
)

export const FailedToGetRuntimeEnv = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_ENV`,
  'Failed to get runtime environment variables %s.'
)

export const FailedToGetRuntimeOpenapi = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_OPENAPI`,
  'Failed to get runtime OpenAPI schema %s.'
)

export const FailedToStreamRuntimeLogs = createError(
  `${ERROR_PREFIX}_FAILED_TO_STREAM_RUNTIME_LOGS`,
  'Failed to stream runtime logs %s.'
)

export const FailedToStopRuntime = createError(
  `${ERROR_PREFIX}_FAILED_TO_STOP_RUNTIME`,
  'Failed to stop the runtime %s.'
)

export const FailedToReloadRuntime = createError(
  `${ERROR_PREFIX}_FAILED_TO_RELOAD_RUNTIME`,
  'Failed to reload the runtime %s.'
)

export const FailedToGetRuntimeConfig = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_CONFIG`,
  'Failed to get runtime config %s.'
)

export const FailedToGetRuntimeApplicationEnv = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_APPLICATION_ENV`,
  'Failed to get runtime application environment variables %s.'
)

export const FailedToGetRuntimeApplicationConfig = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_APPLICATION_CONFIG`,
  'Failed to get runtime application config %s.'
)

export const FailedToGetRuntimeHistoryLogs = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS`,
  'Failed to get history logs %s.'
)

export const FailedToGetRuntimeAllLogs = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_ALL_LOGS`,
  'Failed to get runtime all logs %s.'
)

export const FailedToGetRuntimeLogIndexes = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS_COUNT`,
  'Failed to get history logs count %s.'
)

export const FailedToGetRuntimeMetrics = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METRICS`,
  'Failed to get runtime metrics %s.'
)

export const ProfilingAlreadyStarted = createError(
  `${ERROR_PREFIX}_PROFILING_ALREADY_STARTED`,
  'Profiling is already started for service "%s".'
)

export const ProfilingNotStarted = createError(
  `${ERROR_PREFIX}_PROFILING_NOT_STARTED`,
  'Profiling not started for service "%s".'
)

export const FailedToStartProfiling = createError(
  `${ERROR_PREFIX}_FAILED_TO_START_PROFILING`,
  'Failed to start profiling for service "%s": %s'
)

export const FailedToStopProfiling = createError(
  `${ERROR_PREFIX}_FAILED_TO_STOP_PROFILING`,
  'Failed to stop profiling for service "%s": %s'
)

export const FailedToAddApplications = createError(
  `${ERROR_PREFIX}_FAILED_TO_ADD_APPLICATIONS`,
  'Failed to add applications: %s'
)

export const FailedToRemoveApplications = createError(
  `${ERROR_PREFIX}_FAILED_TO_REMOVE_APPLICATIONS`,
  'Failed to remove applications: %s'
)

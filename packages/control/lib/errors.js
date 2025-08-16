import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_CTR'

export const RuntimeNotFound = createError(`${ERROR_PREFIX}_RUNTIME_NOT_FOUND`, 'Runtime not found.')

export const ServiceNotFound = createError(`${ERROR_PREFIX}_SERVICE_NOT_FOUND`, 'Service not found.')

export const MissingRequestURL = createError(`${ERROR_PREFIX}_MISSING_REQUEST_URL`, 'Request URL is required.')

export const FailedToGetRuntimeMetadata = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METADATA`,
  'Failed to get runtime metadata %s.'
)

export const FailedToGetRuntimeServices = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICES`,
  'Failed to get runtime services %s.'
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

export const FailedToGetRuntimeServiceEnv = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICE_ENV`,
  'Failed to get runtime service environment variables %s.'
)

export const FailedToGetRuntimeServiceConfig = createError(
  `${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICE_CONFIG`,
  'Failed to get runtime service config %s.'
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

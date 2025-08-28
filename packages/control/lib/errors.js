'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_CTR'

module.exports = {
  RuntimeNotFound: createError(`${ERROR_PREFIX}_RUNTIME_NOT_FOUND`, 'Runtime not found.'),
  ServiceNotFound: createError(`${ERROR_PREFIX}_SERVICE_NOT_FOUND`, 'Service not found.'),
  MissingRequestURL: createError(`${ERROR_PREFIX}_MISSING_REQUEST_URL`, 'Request URL is required.'),
  FailedToGetRuntimeMetadata: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METADATA`, 'Failed to get runtime metadata %s.'),
  FailedToGetRuntimeServices: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICES`, 'Failed to get runtime services %s.'),
  FailedToGetRuntimeEnv: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_ENV`, 'Failed to get runtime environment variables %s.'),
  FailedToGetRuntimeOpenapi: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_OPENAPI`, 'Failed to get runtime OpenAPI schema %s.'),
  FailedToStreamRuntimeLogs: createError(`${ERROR_PREFIX}_FAILED_TO_STREAM_RUNTIME_LOGS`, 'Failed to stream runtime logs %s.'),
  FailedToStopRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_STOP_RUNTIME`, 'Failed to stop the runtime %s.'),
  FailedToReloadRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_RELOAD_RUNTIME`, 'Failed to reload the runtime %s.'),
  FailedToGetRuntimeConfig: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_CONFIG`, 'Failed to get runtime config %s.'),
  FailedToGetRuntimeServiceEnv: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICE_ENV`, 'Failed to get runtime service environment variables %s.'),
  FailedToGetRuntimeServiceConfig: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICE_CONFIG`, 'Failed to get runtime service config %s.'),
  FailedToGetRuntimeHistoryLogs: createError(`${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS`, 'Failed to get history logs %s.'),
  FailedToGetRuntimeAllLogs: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_ALL_LOGS`, 'Failed to get runtime all logs %s.'),
  FailedToGetRuntimeLogIndexes: createError(`${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS_COUNT`, 'Failed to get history logs count %s.'),
  FailedToGetRuntimeMetrics: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METRICS`, 'Failed to get runtime metrics %s.'),
  ProfilingAlreadyStarted: createError(`${ERROR_PREFIX}_PROFILING_ALREADY_STARTED`, 'Profiling is already started for service "%s".'),
  ProfilingNotStarted: createError(`${ERROR_PREFIX}_PROFILING_NOT_STARTED`, 'Profiling not started for service "%s".'),
  FailedToStartProfiling: createError(`${ERROR_PREFIX}_FAILED_TO_START_PROFILING`, 'Failed to start profiling for service "%s": %s'),
  FailedToStopProfiling: createError(`${ERROR_PREFIX}_FAILED_TO_STOP_PROFILING`, 'Failed to stop profiling for service "%s": %s'),
}

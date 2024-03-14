'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_CTR'

module.exports = {
  RuntimeNotFound: createError(`${ERROR_PREFIX}_RUNTIME_NOT_FOUND`, 'Runtime not found.'),
  MissingRuntimeIdentifier: createError(`${ERROR_PREFIX}_MISSING_RUNTIME_IDENTIFIER`, 'Runtime name or PID is required.'),
  MissingRequestURL: createError(`${ERROR_PREFIX}_MISSING_REQUEST_URL`, 'Request URL is required.'),
  FailedToGetRuntimeMetadata: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_METADATA`, 'Failed to get runtime metadata %s.'),
  FailedToGetRuntimeServices: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICES`, 'Failed to get runtime services %s.'),
  FailedToGetRuntimeEnv: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_ENV`, 'Failed to get runtime environment variables %s.'),
  FailedToInjectRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_INJECT_RUNTIME`, 'Failed to inject runtime %s.'),
  FailedToStreamRuntimeLogs: createError(`${ERROR_PREFIX}_FAILED_TO_STREAM_RUNTIME_LOGS`, 'Failed to stream runtime logs %s.'),
  FailedToRestartRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_RESTART_RUNTIME`, 'Failed to restart runtime %s.'),
  FailedToStopRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_STOP_RUNTIME`, 'Failed to stop the runtime %s.'),
  FailedToReloadRuntime: createError(`${ERROR_PREFIX}_FAILED_TO_RELOAD_RUNTIME`, 'Failed to reload the runtime %s.'),
  FailedToGetRuntimeConfig: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_CONFIG`, 'Failed to get runtime config %s.'),
  FailedToGetRuntimeServiceConfig: createError(`${ERROR_PREFIX}_FAILED_TO_GET_RUNTIME_SERVICE_CONFIG`, 'Failed to get runtime service config %s.'),
  FailedToGetRuntimeHistoryLogs: createError(`${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS`, 'Failed to get history logs %s.'),
  FailedToGetRuntimeLogIndexes: createError(`${ERROR_PREFIX}_FAILED_TO_GET_HISTORY_LOGS_COUNT`, 'Failed to get history logs count %s.')
}

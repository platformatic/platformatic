'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_RUNTIME'

module.exports = {
  RuntimeExitedError: createError(`${ERROR_PREFIX}_RUNTIME_EXIT`, 'The runtime exited before the operation completed'),
  UnknownRuntimeAPICommandError: createError(`${ERROR_PREFIX}_UNKNOWN_RUNTIME_API_COMMAND`, 'Unknown Runtime API command "%s"'),
  ServiceNotFoundError: createError(`${ERROR_PREFIX}_SERVICE_NOT_FOUND`, "Service with id '%s' not found"),
  ServiceNotStartedError: createError(`${ERROR_PREFIX}_SERVICE_NOT_STARTED`, "Service with id '%s' is not started"),
  FailedToRetrieveOpenAPISchemaError: createError(`${ERROR_PREFIX}_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA`, 'Failed to retrieve OpenAPI schema for service with id "%s": %s'),
  FailedToRetrieveGraphQLSchemaError: createError(`${ERROR_PREFIX}_FAILED_TO_RETRIEVE_GRAPHQL_SCHEMA`, 'Failed to retrieve GraphQL schema for service with id "%s": %s'),
  ApplicationAlreadyStartedError: createError(`${ERROR_PREFIX}_APPLICATION_ALREADY_STARTED`, 'Application is already started'),
  ApplicationNotStartedError: createError(`${ERROR_PREFIX}_APPLICATION_NOT_STARTED`, 'Application has not been started'),
  ConfigPathMustBeStringError: createError(`${ERROR_PREFIX}_CONFIG_PATH_MUST_BE_STRING`, 'Config path must be a string'),
  NoConfigFileFoundError: createError(`${ERROR_PREFIX}_NO_CONFIG_FILE_FOUND`, "No config file found for service '%s'"),
  InvalidEntrypointError: createError(`${ERROR_PREFIX}_INVALID_ENTRYPOINT`, "Invalid entrypoint: '%s' does not exist"),
  MissingDependencyError: createError(`${ERROR_PREFIX}_MISSING_DEPENDENCY`, 'Missing dependency: "%s"'),
  InspectAndInspectBrkError: createError(`${ERROR_PREFIX}_INSPECT_AND_INSPECT_BRK`, '--inspect and --inspect-brk cannot be used together'),
  InspectorPortError: createError(`${ERROR_PREFIX}_INSPECTOR_PORT`, 'Inspector port must be 0 or in range 1024 to 65535'),
  InspectorHostError: createError(`${ERROR_PREFIX}_INSPECTOR_HOST`, 'Inspector host cannot be empty'),
  CannotMapSpecifierToAbsolutePathError: createError(`${ERROR_PREFIX}_CANNOT_MAP_SPECIFIER_TO_ABSOLUTE_PATH`, 'Cannot map "%s" to an absolute path'),
  NodeInspectorFlagsNotSupportedError: createError(`${ERROR_PREFIX}_NODE_INSPECTOR_FLAGS_NOT_SUPPORTED`, 'The Node.js inspector flags are not supported. Please use \'platformatic start --inspect\' instead.')
}

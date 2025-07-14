'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_RUNTIME'

const AddressInUseError = createError(
  `${ERROR_PREFIX}_EADDR_IN_USE`,
  'The current port is in use by another application'
)
const RuntimeExitedError = createError(
  `${ERROR_PREFIX}_RUNTIME_EXIT`,
  'The runtime exited before the operation completed'
)
const RuntimeAbortedError = createError(`${ERROR_PREFIX}_RUNTIME_ABORT`, 'The runtime aborted the operation')
// The following two use the same code as we only need to differentiate the label
const ServiceExitedError = createError(
  `${ERROR_PREFIX}_SERVICE_EXIT`,
  'The service "%s" exited prematurely with error code %d'
)
const WorkerExitedError = createError(
  `${ERROR_PREFIX}_SERVICE_EXIT`,
  'The worker %s of the service "%s" exited prematurely with error code %d'
)
const UnknownRuntimeAPICommandError = createError(
  `${ERROR_PREFIX}_UNKNOWN_RUNTIME_API_COMMAND`,
  'Unknown Runtime API command "%s"'
)
const ServiceNotFoundError = createError(
  `${ERROR_PREFIX}_SERVICE_NOT_FOUND`,
  'Service %s not found. Available services are: %s'
)
const WorkerNotFoundError = createError(
  `${ERROR_PREFIX}_WORKER_NOT_FOUND`,
  'Worker %s of service %s not found. Available services are: %s'
)
const ServiceNotStartedError = createError(`${ERROR_PREFIX}_SERVICE_NOT_STARTED`, "Service with id '%s' is not started")
const ServiceStartTimeoutError = createError(
  `${ERROR_PREFIX}_SERVICE_START_TIMEOUT`,
  "Service with id '%s' failed to start in %dms."
)
const FailedToRetrieveOpenAPISchemaError = createError(
  `${ERROR_PREFIX}_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA`,
  'Failed to retrieve OpenAPI schema for service with id "%s": %s'
)
const FailedToRetrieveGraphQLSchemaError = createError(
  `${ERROR_PREFIX}_FAILED_TO_RETRIEVE_GRAPHQL_SCHEMA`,
  'Failed to retrieve GraphQL schema for service with id "%s": %s'
)
const FailedToRetrieveMetaError = createError(
  `${ERROR_PREFIX}_FAILED_TO_RETRIEVE_META`,
  'Failed to retrieve metadata for service with id "%s": %s'
)
const FailedToRetrieveMetricsError = createError(
  `${ERROR_PREFIX}_FAILED_TO_RETRIEVE_METRICS`,
  'Failed to retrieve metrics for service with id "%s": %s'
)
const FailedToRetrieveHealthError = createError(
  `${ERROR_PREFIX}_FAILED_TO_RETRIEVE_HEALTH`,
  'Failed to retrieve health for service with id "%s": %s'
)
const FailedToPerformCustomHealthCheckError = createError(
  `${ERROR_PREFIX}_FAILED_TO_PERFORM_CUSTOM_HEALTH_CHECK`,
  'Failed to perform custom healthcheck for service with id "%s": %s'
)
const FailedToPerformCustomReadinessCheckError = createError(
  `${ERROR_PREFIX}_FAILED_TO_PERFORM_CUSTOM_READINESS_CHECK`,
  'Failed to perform custom readiness check for service with id "%s": %s'
)
const ApplicationAlreadyStartedError = createError(
  `${ERROR_PREFIX}_APPLICATION_ALREADY_STARTED`,
  'Application is already started'
)
const ApplicationNotStartedError = createError(
  `${ERROR_PREFIX}_APPLICATION_NOT_STARTED`,
  'Application has not been started'
)
const ConfigPathMustBeStringError = createError(
  `${ERROR_PREFIX}_CONFIG_PATH_MUST_BE_STRING`,
  'Config path must be a string'
)
const NoConfigFileFoundError = createError(
  `${ERROR_PREFIX}_NO_CONFIG_FILE_FOUND`,
  "No config file found for service '%s'"
)
const InvalidEntrypointError = createError(
  `${ERROR_PREFIX}_INVALID_ENTRYPOINT`,
  "Invalid entrypoint: '%s' does not exist"
)
const MissingEntrypointError = createError(`${ERROR_PREFIX}_MISSING_ENTRYPOINT`, 'Missing application entrypoint.')
const InvalidServicesWithWebError = createError(
  `${ERROR_PREFIX}_INVALID_SERVICES_WITH_WEB`,
  'The "services" property cannot be used when the "web" property is also defined'
)
const MissingDependencyError = createError(`${ERROR_PREFIX}_MISSING_DEPENDENCY`, 'Missing dependency: "%s"')
const InspectAndInspectBrkError = createError(
  `${ERROR_PREFIX}_INSPECT_AND_INSPECT_BRK`,
  '--inspect and --inspect-brk cannot be used together'
)
const InspectorPortError = createError(
  `${ERROR_PREFIX}_INSPECTOR_PORT`,
  'Inspector port must be 0 or in range 1024 to 65535'
)
const InspectorHostError = createError(`${ERROR_PREFIX}_INSPECTOR_HOST`, 'Inspector host cannot be empty')
const CannotMapSpecifierToAbsolutePathError = createError(
  `${ERROR_PREFIX}_CANNOT_MAP_SPECIFIER_TO_ABSOLUTE_PATH`,
  'Cannot map "%s" to an absolute path'
)
const NodeInspectorFlagsNotSupportedError = createError(
  `${ERROR_PREFIX}_NODE_INSPECTOR_FLAGS_NOT_SUPPORTED`,
  "The Node.js inspector flags are not supported. Please use 'platformatic start --inspect' instead."
)
const FailedToUnlinkManagementApiSocket = createError(
  `${ERROR_PREFIX}_FAILED_TO_UNLINK_MANAGEMENT_API_SOCKET`,
  'Failed to unlink management API socket "%s"'
)
const LogFileNotFound = createError(`${ERROR_PREFIX}_LOG_FILE_NOT_FOUND`, 'Log file with index %s not found', 404)
const WorkerIsRequired = createError(`${ERROR_PREFIX}_REQUIRED_WORKER`, 'The worker parameter is required')
const InvalidArgumentError = createError(`${ERROR_PREFIX}_INVALID_ARGUMENT`, 'Invalid argument: "%s"')
const MessagingError = createError(`${ERROR_PREFIX}_MESSAGING_ERROR`, 'Cannot send a message to service "%s": %s')

module.exports = {
  AddressInUseError,
  RuntimeExitedError,
  RuntimeAbortedError,
  ServiceExitedError,
  WorkerExitedError,
  UnknownRuntimeAPICommandError,
  ServiceNotFoundError,
  WorkerNotFoundError,
  ServiceNotStartedError,
  ServiceStartTimeoutError,
  FailedToRetrieveOpenAPISchemaError,
  FailedToRetrieveGraphQLSchemaError,
  FailedToRetrieveMetaError,
  FailedToRetrieveMetricsError,
  FailedToRetrieveHealthError,
  FailedToPerformCustomHealthCheckError,
  FailedToPerformCustomReadinessCheckError,
  ApplicationAlreadyStartedError,
  ApplicationNotStartedError,
  ConfigPathMustBeStringError,
  NoConfigFileFoundError,
  InvalidEntrypointError,
  MissingEntrypointError,
  InvalidServicesWithWebError,
  MissingDependencyError,
  InspectAndInspectBrkError,
  InspectorPortError,
  InspectorHostError,
  CannotMapSpecifierToAbsolutePathError,
  NodeInspectorFlagsNotSupportedError,
  FailedToUnlinkManagementApiSocket,
  LogFileNotFound,
  WorkerIsRequired,
  InvalidArgumentError,
  MessagingError
}

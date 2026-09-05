# Platformatic Errors 

## @platformatic/basic 

### PLT_BASIC_CAPABILITY_FACTORY_KEY_COLLISION
**Message:** %s cannot flatten '%s' from the %s block: it already collides with %s. 

### PLT_BASIC_CAPABILITY_FACTORY_OPTIONS_REQUIRED
**Message:** defineCapabilityFactory requires the capability module name as its first argument. 

### PLT_BASIC_NON_ZERO_EXIT_CODE
**Message:** Process exited with non zero exit code %d. 

### PLT_BASIC_SCHEDULED_TASK_GROUP_NOT_FOUND
**Message:** Scheduled task group "%s" not found 

### PLT_BASIC_SCHEDULED_TASK_NOT_FOUND
**Message:** Scheduled task "%s" not found 

### PLT_BASIC_UNSUPPORTED_VERSION
**Message:** %s version %s is not supported. Please use version %s. 

## @platformatic/composer 

### PLT_GATEWAY_COULD_NOT_READ_OPENAPI_CONFIG
**Message:** Could not read openapi config for "%s" application 

### PLT_GATEWAY_FAILED_TO_FETCH_OPENAPI_SCHEMA
**Message:** Failed to fetch OpenAPI schema from %s 

### PLT_GATEWAY_FASTIFY_INSTANCE_IS_ALREADY_LISTENING
**Message:** Fastify instance is already listening. Cannot call "addGatewayOnRouteHook"! 

### PLT_GATEWAY_INVALID_OPENAPI_SCHEMA
**Message:** Failed to compose OpenAPI schemas: %s 

### PLT_GATEWAY_PATH_ALREADY_EXISTS
**Message:** Path "%s" is exposed by both the "%s" and the "%s" applications. Set a different openapi.prefix on one of them to resolve the conflict. 

### PLT_GATEWAY_VALIDATION_ERRORS
**Message:** Validation errors: %s 

## @platformatic/db 

### PLT_DB_MIGRATE_ERROR
**Message:** Unable to apply migration %s: %s 

### PLT_DB_INVALID_SCHEMA_LOCK_ERROR
**Message:** Invalid schema lock format. 

### PLT_DB_MIGRATE_ERROR
**Message:** Migrations directory %s does not exist 

### PLT_DB_MIGRATE_ERROR
**Message:** Missing "migrations" section in config file 

### PLT_DB_MIGRATIONS_TO_APPLY_ERROR
**Message:** You have migrations to apply. 

### PLT_DB_MISSING_SEED_FILE_ERROR
**Message:** Missing seed file 

### PLT_DB_UNKNOWN_DATABASE_ERROR
**Message:** Unknown database 

## @platformatic/db-authorization 

### PLT_DB_AUTH_NOT_NULLABLE_MISSING
**Message:** missing not nullable field: "%s" in save rule for entity "%s" 

### PLT_DB_AUTH_UNAUTHORIZED
**Message:** operation not allowed 

### PLT_DB_AUTH_FIELD_UNAUTHORIZED
**Message:** field not allowed: %s 

## @platformatic/foundation 

### PLT_ADD_A_MODULE_PROPERTY_TO_THE_CONFIG_OR_ADD_A_KNOWN_SCHEMA
**Message:** Add a module property to the config or add a known $schema. 

### PLT_CANNOT_PARSE_CONFIG_FILE
**Message:** Cannot parse config file. %s 

### PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA
**Message:** The configuration does not validate against the configuration schema 

### PLT_INVALID_CONFIG_FILE_EXTENSION
**Message:** Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported. 

### PLT_MISSING_ENV_VARIABLES
**Message:** The configuration references the following environment variables which are not set: %s 

### PLT_NO_CONFIG_FILE_FOUND
**Message:** no config file found 

### PLT_PATH_OPTION_REQUIRED
**Message:** path option is required 

### PLT_ROOT_MISSING
**Message:** Provide the root option to loadConfiguration when using an object as source. 

### PLT_SCHEMA_MUST_BE_DEFINED
**Message:** schema must be defined 

### PLT_SOURCE_MISSING
**Message:** Source missing. 

## @platformatic/gateway 

### PLT_GATEWAY_COULD_NOT_READ_OPENAPI_CONFIG
**Message:** Could not read openapi config for "%s" application 

### PLT_GATEWAY_FAILED_TO_FETCH_OPENAPI_SCHEMA
**Message:** Failed to fetch OpenAPI schema from %s 

### PLT_GATEWAY_FASTIFY_INSTANCE_IS_ALREADY_LISTENING
**Message:** Fastify instance is already listening. Cannot call "addGatewayOnRouteHook"! 

### PLT_GATEWAY_INVALID_OPENAPI_SCHEMA
**Message:** Failed to compose OpenAPI schemas: %s 

### PLT_GATEWAY_PATH_ALREADY_EXISTS
**Message:** Path "%s" is exposed by both the "%s" and the "%s" applications. Set a different openapi.prefix on one of them to resolve the conflict. 

### PLT_GATEWAY_VALIDATION_ERRORS
**Message:** Validation errors: %s 

## @platformatic/itc 

### PLT_ITC_HANDLER_FAILED
**Message:** Handler failed with error: %s 

### PLT_ITC_HANDLER_NOT_FOUND
**Message:** Handler not found for request: "%s" 

### PLT_ITC_INVALID_REQUEST_VERSION
**Message:** Invalid ITC request version: "%s" 

### PLT_ITC_INVALID_RESPONSE_VERSION
**Message:** Invalid ITC response version: "%s" 

### PLT_ITC_MESSAGE_PORT_CLOSED
**Message:** ITC MessagePort is closed 

### PLT_ITC_MISSING_NAME
**Message:** ITC name is missing 

### PLT_ITC_MISSING_REQUEST_NAME
**Message:** ITC request name is missing 

### PLT_ITC_MISSING_REQUEST_REQ_ID
**Message:** ITC request reqId is missing 

### PLT_ITC_MISSING_RESPONSE_NAME
**Message:** ITC response name is missing 

### PLT_ITC_MISSING_RESPONSE_REQ_ID
**Message:** ITC response reqId is missing 

### PLT_ITC_ALREADY_LISTENING
**Message:** ITC is already listening 

### PLT_ITC_REQUEST_NAME_IS_NOT_STRING
**Message:** ITC request name is not a string: "%s" 

### PLT_ITC_SEND_BEFORE_LISTEN
**Message:** ITC cannot send requests before listening 

## @platformatic/next 

### PLT_NEXT_CANNOT_PARSE_STANDALONE_SERVER
**Message:** Cannot parse nextConfig from standalone server.js. 

### PLT_NEXT_CANNOT_FIND_STANDALONE_SERVER
**Message:** Cannot find server.js entrypoint in .next/standalone. 

## @platformatic/runtime 

### PLT_RUNTIME_EADDR_IN_USE
**Message:** Port %d is already in use by applications "%s" and "%s" 

### PLT_RUNTIME_APPLICATION_ALREADY_STARTED
**Message:** Application is already started 

### PLT_RUNTIME_APPLICATION_DEPENDENCY_NOT_FOUND
**Message:** Application dependency %s not found. Available applications are: %s 

### PLT_RUNTIME_APPLICATION_EXIT
**Message:** The application "%s" exited prematurely with error code %d 

### PLT_RUNTIME_APPLICATION_NOT_FOUND
**Message:** Application %s not found. Available applications are: %s 

### PLT_RUNTIME_APPLICATION_NOT_STARTED
**Message:** Application with id '%s' is not started 

### PLT_RUNTIME_APPLICATION_START_TIMEOUT
**Message:** Application with id '%s' failed to start in %dms. 

### PLT_RUNTIME_APPLICATIONS_DEPENDENCIES_CYCLE
**Message:** Detected a cycle in the applications dependencies: %s 

### PLT_RUNTIME_CANNOT_MAP_SPECIFIER_TO_ABSOLUTE_PATH
**Message:** Cannot map "%s" to an absolute path 

### PLT_RUNTIME_CONFIG_PATH_MUST_BE_STRING
**Message:** Config path must be a string 

### PLT_RUNTIME_DUPLICATE_EXTENSION_HEALTH_CHECK
**Message:** The extension health %s check "%s" has already been registered by "%s" 

### PLT_RUNTIME_DUPLICATE_EXTENSION_HEALTH_ROUTE
**Message:** The extension "%s" failed to register health route %s %s: %s 

### PLT_RUNTIME_DUPLICATE_ITC_HANDLER_NAME
**Message:** The ITC command "%s" has already been registered 

### PLT_RUNTIME_DUPLICATE_SCHEDULER_JOB
**Message:** Scheduler "%s" is already registered 

### PLT_RUNTIME_EXTENSION_HEALTH_ROUTES_UNAVAILABLE
**Message:** Extensions registered health routes but no health probes server is available 

### PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION
**Message:** Failed to load the extension "%s": %s 

### PLT_RUNTIME_FAILED_TO_PERFORM_CUSTOM_HEALTH_CHECK
**Message:** Failed to perform custom healthcheck for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_PERFORM_CUSTOM_READINESS_CHECK
**Message:** Failed to perform custom readiness check for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_GRAPHQL_SCHEMA
**Message:** Failed to retrieve GraphQL schema for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_HEALTH
**Message:** Failed to retrieve health for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_META
**Message:** Failed to retrieve metadata for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_METRICS
**Message:** Failed to retrieve metrics for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA
**Message:** Failed to retrieve OpenAPI schema for application with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_SEND_HEALTH_SIGNALS
**Message:** Cannot send health signals from application "%s": %s 

### PLT_RUNTIME_FAILED_TO_START_EXTENSION
**Message:** Failed to start the extension "%s": %s 

### PLT_RUNTIME_FAILED_TO_STOP_EXTENSION
**Message:** Failed to stop the extension "%s": %s 

### PLT_RUNTIME_FAILED_TO_UNLINK_MANAGEMENT_API_SOCKET
**Message:** Failed to unlink management API socket "%s" 

### PLT_RUNTIME_HEALTH_SIGNAL_MUST_BE_OBJECT
**Message:** Health signal must be an object 

### PLT_RUNTIME_HEALTH_SIGNAL_TYPE_MUST_BE_STRING
**Message:** Health signal type must be a string, received "%s" 

### PLT_RUNTIME_INSPECT_AND_INSPECT_BRK
**Message:** --inspect and --inspect-brk cannot be used together 

### PLT_RUNTIME_INSPECTOR_HOST
**Message:** Inspector host cannot be empty 

### PLT_RUNTIME_INSPECTOR_PORT
**Message:** Inspector port must be 0 or in range 1024 to 65535 

### PLT_RUNTIME_INVALID_ARGUMENT
**Message:** Invalid argument: "%s" 

### PLT_RUNTIME_INVALID_EXTENSION
**Message:** The extension "%s" must export a setup function as its default export or as a named "setup" export 

### PLT_RUNTIME_LAST_PROFILE_TIMEOUT
**Message:** Timed out while retrieving the last profile from the application "%s" 

### PLT_RUNTIME_LOG_FILE_NOT_FOUND
**Message:** Log file with index %s not found 

### PLT_RUNTIME_MESSAGING_ERROR
**Message:** Cannot send a message to application "%s": %s 

### PLT_RUNTIME_METRIC_FAMILY_COLLISION
**Message:** Extension "%s" registered metric family "%s" which collides with %s 

### PLT_RUNTIME_MISSING_DEPENDENCY
**Message:** Missing dependency: "%s" 

### PLT_RUNTIME_MISSING_PPROF_CAPTURE
**Message:** Please install @platformatic/wattpm-pprof-capture 

### PLT_RUNTIME_MIXED_SERVING_STATE
**Message:** The workers of the application "%s" disagree about how it serves: %s. One application is one thing; workers that disagree about whether it serves HTTP would have the mesh route a share of requests to a worker that destroys them. 

### PLT_RUNTIME_NO_CONFIG_FILE_FOUND
**Message:** No config file found for application '%s' 

### PLT_RUNTIME_NODE_INSPECTOR_FLAGS_NOT_SUPPORTED
**Message:** The Node.js inspector flags are not supported. Please use 'wattpm start --inspect' instead. 

### PLT_RUNTIME_RESERVED_ITC_HANDLER_NAME
**Message:** The ITC command name "%s" is reserved by the runtime 

### PLT_RUNTIME_RUNTIME_ABORT
**Message:** The runtime aborted the operation 

### PLT_RUNTIME_RUNTIME_EXIT
**Message:** The runtime exited before the operation completed 

### PLT_RUNTIME_EXTENSION_BUILD_ALREADY_CALLED
**Message:** The build function can only be called once by each runtime extension. 

### PLT_RUNTIME_NOT_STARTED
**Message:** Application has not been started 

### PLT_RUNTIME_SCHEDULER_JOB_NOT_FOUND
**Message:** Scheduler "%s" not found 

### PLT_RUNTIME_UNKNOWN_RUNTIME_API_COMMAND
**Message:** Unknown Runtime API command "%s" 

### PLT_RUNTIME_WORKER_EADDR_IN_USE
**Message:** Port %d is already in use by another worker of the application "%s". Multiple workers can share a port only when the reusePort feature is available in your OS, otherwise set "server.portAssignment" to "perWorkerIncrement" in the application configuration or use a single worker. 

### PLT_RUNTIME_APPLICATION_WORKER_EXIT
**Message:** The worker %s of the application "%s" exited prematurely with error code %d 

### PLT_RUNTIME_WORKER_INTERCEPTOR_JOIN_TIMEOUT
**Message:** The %s failed to join the mesh network in %dms. 

### PLT_RUNTIME_WORKER_INTERCEPTOR_NOT_READY
**Message:** The "%s" application worker interceptor is not ready 

### PLT_RUNTIME_REQUIRED_WORKER
**Message:** The worker parameter is required 

### PLT_RUNTIME_WORKER_NOT_FOUND
**Message:** Worker %s of application %s not found. Available workers are: %s 

## @platformatic/sql-events 

### PLT_SQL_EVENTS_NO_SUCH_ACTION
**Message:** No such action %s 

### PLT_SQL_EVENTS_OBJECT_IS_REQUIRED_UNDER_THE_DATA_PROPERTY
**Message:** The object that will be published is required under the data property 

### PLT_SQL_EVENTS_PRIMARY_KEY_IS_NECESSARY_INSIDE_DATA
**Message:** The primaryKey is necessary inside data 

## @platformatic/sql-graphql 

### PLT_SQL_GRAPHQL_ERROR_PRINTING_GRAPHQL_SCHEMA
**Message:** Error printing the GraphQL schema 

### PLT_SQL_GRAPHQL_UNABLE_GENERATE_GRAPHQL_ENUM_TYPE
**Message:** Unable to generate GraphQLEnumType 

### PLT_SQL_GRAPHQL_UNSUPPORTED_KIND
**Message:** Unsupported kind: %s 

## @platformatic/sql-mapper 

### PLT_SQL_MAPPER_CANNOT_ACCESS_DATABASE_FILE
**Message:** Cannot open SQLite database file "%s": %s 

### PLT_SQL_MAPPER_CANNOT_FIND_ENTITY
**Message:** Cannot find entity %s 

### PLT_SQL_MAPPER_CONNECTION_STRING_REQUIRED
**Message:** connectionString is required 

### PLT_SQL_MAPPER_INPUT_NOT_PROVIDED
**Message:** Input not provided. 

### PLT_SQL_MAPPER_INVALID_PRIMARY_KEY_TYPE
**Message:** Invalid Primary Key type: "%s". We support the following: %s 

### PLT_SQL_MAPPER_MISSING_ORDER_BY_CLAUSE
**Message:** Missing orderBy clause 

### PLT_SQL_MAPPER_MISSING_ORDER_BY_FIELD_FOR_CURSOR
**Message:** Cursor field(s) %s must be included in orderBy 

### PLT_SQL_MAPPER_MISSING_UNIQUE_FIELD_IN_CURSOR
**Message:** Cursor must contain at least one primary key field 

### PLT_SQL_MAPPER_MISSING_VALUE_FOR_PRIMARY_KEY
**Message:** Missing value for primary key %s 

### PLT_SQL_MAPPER_MISSING_WHERE_CLAUSE
**Message:** Missing where clause 

### PLT_SQL_MAPPER_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE
**Message:** Param limit=%s not allowed. It must be a not negative value. 

### PLT_SQL_MAPPER_PARAM_LIMIT_NOT_ALLOWED
**Message:** Param limit=%s not allowed. Max accepted value %s. 

### PLT_SQL_MAPPER_PARAM_NOT_ALLOWED
**Message:** Param offset=%s not allowed. It must be not negative value. 

### PLT_SQL_MAPPER_SQLITE_ONLY_SUPPORTS_AUTO_INCREMENT_ON_ONE_COLUMN
**Message:** SQLite only supports autoIncrement on one column 

### PLT_SQL_MAPPER_SPECIFY_PROTOCOLS
**Message:** You must specify either postgres, mysql or sqlite as protocols 

### PLT_SQL_MAPPER_TABLE_MUST_BE_A_STRING
**Message:** Table must be a string, got %s 

### PLT_SQL_MAPPER_UNKNOWN_FIELD
**Message:** Unknown field %s 

### PLT_SQL_MAPPER_UNSUPPORTED_OPERATOR
**Message:** Unsupported operator for Array field 

### PLT_SQL_MAPPER_UNSUPPORTED_OPERATOR_FOR_NON_ARRAY
**Message:** Unsupported operator for non Array field 

### PLT_SQL_MAPPER_UNSUPPORTED_WHERE_CLAUSE
**Message:** Unsupported where clause %s 

## @platformatic/sql-openapi 

### PLT_SQL_OPENAPI_CURSOR_VALIDATION_ERROR
**Message:** Cursor validation error. %s 

### PLT_SQL_OPENAPI_PRIMARY_KEY_NOT_INCLUDED_IN_ORDER_BY_IN_CURSOR_PAGINATION
**Message:** At least one primary key must be included in orderBy clause in case of cursor pagination 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP
**Message:** Unable to create the route for the PK col relationship 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP
**Message:** Unable to create the route for the reverse relationship 

### PLT_SQL_OPENAPI_UNABLE_TO_PARSE_CURSOR_STR
**Message:** Unable to parse cursor string. Make sure to provide valid encoding of cursor object. Error: %s 

### PLT_SQL_OPENAPI_UNKNOWN_FIELD
**Message:** Unknown field "%s" in where.or 

## @platformatic/wattpm-pprof-capture 

### PLT_PPROF_NO_PROFILE_AVAILABLE
**Message:** No profile available - wait for profiling to complete or trigger manual capture 

### PLT_PPROF_NOT_ENOUGH_ELU
**Message:** No profile available - event loop utilization has been below threshold for too long 

### PLT_PPROF_PROFILING_ALREADY_STARTED
**Message:** Profiling is already started 

### PLT_PPROF_PROFILING_NOT_STARTED
**Message:** Profiling not started - call startProfiling() first 

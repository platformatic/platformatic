# Platformatic Errors 

## @platformatic/basic 

### PLT_BASIC_NON_ZERO_EXIT_CODE
**Message:** Process exited with non zero exit code %d. 

### PLT_BASIC_UNSUPPORTED_VERSION
**Message:** %s version %s is not supported. Please use version %s. 

## @platformatic/client 

### PLT_CLIENT_OPTIONS_URL_REQUIRED
**Message:** options.url is required 

### PLT_CLIENT_FORM_DATA_REQUIRED
**Message:** Operation %s should be called with a undici.FormData as payload 

### PLT_CLIENT_MISSING_PARAMS_REQUIRED
**Message:** Param %s is missing, and it's required 

### PLT_CLIENT_WRONG_OPTS_TYPE
**Message:** opts.type must be either "openapi" or "graphql" 

### PLT_CLIENT_INVALID_RESPONSE_SCHEMA
**Message:** No matching response schema found for status code %s 

### PLT_CLIENT_INVALID_CONTENT_TYPE
**Message:** No matching content type schema found for %s 

### PLT_CLIENT_INVALID_RESPONSE_FORMAT
**Message:** Invalid response format 

### PLT_CLIENT_UNEXPECTED_CALL_FAILURE
**Message:** Unexpected failure calling the client: %s 

## @platformatic/client-cli 

### PLT_CLIENT_CLI_UNKNOWN_TYPE
**Message:** Unknown type %s 

### PLT_CLIENT_CLI_TYPE_NOT_SUPPORTED
**Message:** Type %s not supported 

## @platformatic/composer 

### PLT_COMPOSER_COULD_NOT_READ_OPENAPI_CONFIG
**Message:** Could not read openapi config for "%s" service 

### PLT_COMPOSER_FAILED_TO_FETCH_OPENAPI_SCHEMA
**Message:** Failed to fetch OpenAPI schema from %s 

### PLT_COMPOSER_FASTIFY_INSTANCE_IS_ALREADY_LISTENING
**Message:** Fastify instance is already listening. Cannot call "addComposerOnRouteHook"! 

### PLT_COMPOSER_PATH_ALREADY_EXISTS
**Message:** Path "%s" already exists 

### PLT_COMPOSER_VALIDATION_ERRORS
**Message:** Validation errors: %s 

## @platformatic/control 

### PLT_CTR_RUNTIME_NOT_FOUND
**Message:** Runtime not found. 

### PLT_CTR_SERVICE_NOT_FOUND
**Message:** Service not found. 

### PLT_CTR_MISSING_REQUEST_URL
**Message:** Request URL is required. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_METADATA
**Message:** Failed to get runtime metadata %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_SERVICES
**Message:** Failed to get runtime services %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_ENV
**Message:** Failed to get runtime environment variables %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_OPENAPI
**Message:** Failed to get runtime OpenAPI schema %s. 

### PLT_CTR_FAILED_TO_STREAM_RUNTIME_LOGS
**Message:** Failed to stream runtime logs %s. 

### PLT_CTR_FAILED_TO_STOP_RUNTIME
**Message:** Failed to stop the runtime %s. 

### PLT_CTR_FAILED_TO_RELOAD_RUNTIME
**Message:** Failed to reload the runtime %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_CONFIG
**Message:** Failed to get runtime config %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_SERVICE_ENV
**Message:** Failed to get runtime service environment variables %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_SERVICE_CONFIG
**Message:** Failed to get runtime service config %s. 

### PLT_CTR_FAILED_TO_GET_HISTORY_LOGS
**Message:** Failed to get history logs %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_ALL_LOGS
**Message:** Failed to get runtime all logs %s. 

### PLT_CTR_FAILED_TO_GET_HISTORY_LOGS_COUNT
**Message:** Failed to get history logs count %s. 

### PLT_CTR_FAILED_TO_GET_RUNTIME_METRICS
**Message:** Failed to get runtime metrics %s. 

## @platformatic/db 

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

### PLT_DB_AUTH_UNAUTHORIZED
**Message:** operation not allowed 

### PLT_DB_AUTH_FIELD_UNAUTHORIZED
**Message:** field not allowed: %s 

### PLT_DB_AUTH_NOT_NULLABLE_MISSING
**Message:** missing not nullable field: "%s" in save rule for entity "%s" 

## @platformatic/runtime 

### PLT_RUNTIME_EADDR_IN_USE
**Message:** The current port is in use by another application 

### PLT_RUNTIME_RUNTIME_EXIT
**Message:** The runtime exited before the operation completed 

### PLT_RUNTIME_RUNTIME_ABORT
**Message:** The runtime aborted the operation 

### PLT_RUNTIME_SERVICE_EXIT
**Message:** The service "%s" exited prematurely with error code %d 

### PLT_RUNTIME_SERVICE_EXIT
**Message:** The worker %s of the service "%s" exited prematurely with error code %d 

### PLT_RUNTIME_UNKNOWN_RUNTIME_API_COMMAND
**Message:** Unknown Runtime API command "%s" 

### PLT_RUNTIME_SERVICE_NOT_FOUND
**Message:** Service %s not found. Available services are: %s 

### PLT_RUNTIME_WORKER_NOT_FOUND
**Message:** Worker %s of service %s not found. Available services are: %s 

### PLT_RUNTIME_SERVICE_NOT_STARTED
**Message:** Service with id '%s' is not started 

### PLT_RUNTIME_SERVICE_START_TIMEOUT
**Message:** Service with id '%s' failed to start in %dms. 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA
**Message:** Failed to retrieve OpenAPI schema for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_GRAPHQL_SCHEMA
**Message:** Failed to retrieve GraphQL schema for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_META
**Message:** Failed to retrieve metadata for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_METRICS
**Message:** Failed to retrieve metrics for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_HEALTH
**Message:** Failed to retrieve health for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_PERFORM_CUSTOM_HEALTH_CHECK
**Message:** Failed to perform custom healthcheck for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_PERFORM_CUSTOM_READINESS_CHECK
**Message:** Failed to perform custom readiness check for service with id "%s": %s 

### PLT_RUNTIME_APPLICATION_ALREADY_STARTED
**Message:** Application is already started 

### PLT_RUNTIME_APPLICATION_NOT_STARTED
**Message:** Application has not been started 

### PLT_RUNTIME_CONFIG_PATH_MUST_BE_STRING
**Message:** Config path must be a string 

### PLT_RUNTIME_NO_CONFIG_FILE_FOUND
**Message:** No config file found for service '%s' 

### PLT_RUNTIME_INVALID_ENTRYPOINT
**Message:** Invalid entrypoint: '%s' does not exist 

### PLT_RUNTIME_MISSING_ENTRYPOINT
**Message:** Missing application entrypoint. 

### PLT_RUNTIME_INVALID_SERVICES_WITH_WEB
**Message:** The "services" property cannot be used when the "web" property is also defined 

### PLT_RUNTIME_MISSING_DEPENDENCY
**Message:** Missing dependency: "%s" 

### PLT_RUNTIME_INSPECT_AND_INSPECT_BRK
**Message:** --inspect and --inspect-brk cannot be used together 

### PLT_RUNTIME_INSPECTOR_PORT
**Message:** Inspector port must be 0 or in range 1024 to 65535 

### PLT_RUNTIME_INSPECTOR_HOST
**Message:** Inspector host cannot be empty 

### PLT_RUNTIME_CANNOT_MAP_SPECIFIER_TO_ABSOLUTE_PATH
**Message:** Cannot map "%s" to an absolute path 

### PLT_RUNTIME_NODE_INSPECTOR_FLAGS_NOT_SUPPORTED
**Message:** The Node.js inspector flags are not supported. Please use 'platformatic start --inspect' instead. 

### PLT_RUNTIME_FAILED_TO_UNLINK_MANAGEMENT_API_SOCKET
**Message:** Failed to unlink management API socket "%s" 

### PLT_RUNTIME_LOG_FILE_NOT_FOUND
**Message:** Log file with index %s not found 

### PLT_RUNTIME_REQUIRED_WORKER
**Message:** The worker parameter is required 

### PLT_RUNTIME_INVALID_ARGUMENT
**Message:** Invalid argument: "%s" 

### PLT_RUNTIME_MESSAGING_ERROR
**Message:** Cannot send a message to service "%s": %s 

## @platformatic/sql-events 

### PLT_SQL_EVENTS_OBJECT_IS_REQUIRED_UNDER_THE_DATA_PROPERTY
**Message:** The object that will be published is required under the data property 

### PLT_SQL_EVENTS_PRIMARY_KEY_IS_NECESSARY_INSIDE_DATA
**Message:** The primaryKey is necessary inside data 

### PLT_SQL_EVENTS_NO_SUCH_ACTION
**Message:** No such action %s 

## @platformatic/sql-graphql 

### PLT_SQL_GRAPHQL_UNABLE_GENERATE_GRAPHQL_ENUM_TYPE
**Message:** Unable to generate GraphQLEnumType 

### PLT_SQL_GRAPHQL_UNSUPPORTED_KIND
**Message:** Unsupported kind: %s 

### PLT_SQL_GRAPHQL_ERROR_PRINTING_GRAPHQL_SCHEMA
**Message:** Error printing the GraphQL schema 

## @platformatic/sql-mapper 

### PLT_SQL_MAPPER_CANNOT_FIND_ENTITY
**Message:** Cannot find entity %s 

### PLT_SQL_MAPPER_SPECIFY_PROTOCOLS
**Message:** You must specify either postgres, mysql or sqlite as protocols 

### PLT_SQL_MAPPER_CONNECTION_STRING_REQUIRED
**Message:** connectionString is required 

### PLT_SQL_MAPPER_TABLE_MUST_BE_A_STRING
**Message:** Table must be a string, got %s 

### PLT_SQL_MAPPER_UNKNOWN_FIELD
**Message:** Unknown field %s 

### PLT_SQL_MAPPER_INPUT_NOT_PROVIDED
**Message:** Input not provided. 

### PLT_SQL_MAPPER_UNSUPPORTED_WHERE_CLAUSE
**Message:** Unsupported where clause %s 

### PLT_SQL_MAPPER_UNSUPPORTED_OPERATOR
**Message:** Unsupported operator for Array field 

### PLT_SQL_MAPPER_UNSUPPORTED_OPERATOR_FOR_NON_ARRAY
**Message:** Unsupported operator for non Array field 

### PLT_SQL_MAPPER_PARAM_NOT_ALLOWED
**Message:** Param offset=%s not allowed. It must be not negative value. 

### PLT_SQL_MAPPER_INVALID_PRIMARY_KEY_TYPE
**Message:** Invalid Primary Key type: "%s". We support the following: %s 

### PLT_SQL_MAPPER_PARAM_LIMIT_NOT_ALLOWED
**Message:** Param limit=%s not allowed. Max accepted value %s. 

### PLT_SQL_MAPPER_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE
**Message:** Param limit=%s not allowed. It must be a not negative value. 

### PLT_SQL_MAPPER_MISSING_VALUE_FOR_PRIMARY_KEY
**Message:** Missing value for primary key %s 

### PLT_SQL_MAPPER_MISSING_WHERE_CLAUSE
**Message:** Missing where clause 

### PLT_SQL_MAPPER_SQLITE_ONLY_SUPPORTS_AUTO_INCREMENT_ON_ONE_COLUMN
**Message:** SQLite only supports autoIncrement on one column 

### PLT_SQL_MAPPER_MISSING_ORDER_BY_CLAUSE
**Message:** Missing orderBy clause 

### PLT_SQL_MAPPER_MISSING_ORDER_BY_FIELD_FOR_CURSOR
**Message:** Cursor field(s) %s must be included in orderBy 

### PLT_SQL_MAPPER_MISSING_UNIQUE_FIELD_IN_CURSOR
**Message:** Cursor must contain at least one primary key field 

## @platformatic/sql-openapi 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP
**Message:** Unable to create the route for the reverse relationship 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP
**Message:** Unable to create the route for the PK col relationship 

### PLT_SQL_OPENAPI_UNABLE_TO_PARSE_CURSOR_STR
**Message:** Unable to parse cursor string. Make sure to provide valid encoding of cursor object. Error: %s 

### PLT_SQL_OPENAPI_CURSOR_VALIDATION_ERROR
**Message:** Cursor validation error. %s 

### PLT_SQL_OPENAPI_PRIMARY_KEY_NOT_INCLUDED_IN_ORDER_BY_IN_CURSOR_PAGINATION
**Message:** At least one primary key must be included in orderBy clause in case of cursor pagination 

## @platformatic/foundation 

### PLT_ADD_A_MODULE_PROPERTY_TO_THE_CONFIG_OR_ADD_A_KNOWN_SCHEMA
**Message:** Add a module property to the config or add a known $schema. 

### PLT_CANNOT_PARSE_CONFIG_FILE
**Message:** Cannot parse config file. %s 

### PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA
**Message:** The configuration does not validate against the configuration schema 

### PLT_INVALID_CONFIG_FILE_EXTENSION
**Message:** Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported. 

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

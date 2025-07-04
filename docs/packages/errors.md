# Platformatic Errors 

## @platformatic/client 

### PLT_CLIENT_OPTIONS_URL_REQUIRED
**Message:** options.url is required 

## @platformatic/client-cli 

### PLT_CLIENT_CLI_UNKNOWN_TYPE
**Message:** Unknown type %s 

### PLT_CLIENT_CLI_TYPE_NOT_SUPPORTED
**Message:** Type %s not supported 

## @platformatic/composer 

### PLT_COMPOSER_FASTIFY_INSTANCE_IS_ALREADY_LISTENING
**Message:** Fastify instance is already listening. Cannot call "addComposerOnRouteHook"! 

### PLT_COMPOSER_FAILED_TO_FETCH_OPENAPI_SCHEMA
**Message:** Failed to fetch OpenAPI schema from %s 

### PLT_COMPOSER_VALIDATION_ERRORS
**Message:** Validation errors: %s 

### PLT_COMPOSER_PATH_ALREADY_EXISTS
**Message:** Path "%s" already exists 

### PLT_COMPOSER_COULD_NOT_READ_OPENAPI_CONFIG
**Message:** Could not read openapi config for "%s" service 

## @platformatic/config 

### PLT_CONFIG_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA
**Message:** The configuration does not validate against the configuration schema 

### PLT_CONFIG_SOURCE_MISSING
**Message:** Source missing. 

### PLT_CONFIG_INVALID_PLACEHOLDER
**Message:** %s is an invalid placeholder. All placeholders must be prefixed with PLT_.
Did you mean PLT_%s? 

### PLT_CONFIG_ENV_VAR_MISSING
**Message:** %s env variable is missing. 

### PLT_CONFIG_CANNOT_PARSE_CONFIG_FILE
**Message:** Cannot parse config file. %s 

### PLT_CONFIG_VALIDATION_ERRORS
**Message:** Validation errors: %s 

### PLT_CONFIG_APP_MUST_BE_A_FUNCTION
**Message:** app must be a function 

### PLT_CONFIG_SCHEMA_MUST_BE_DEFINED
**Message:** schema must be defined 

### PLT_CONFIG_SCHEMA_ID_MUST_BE_A_STRING
**Message:** schema.$id must be a string with length > 0 

### PLT_CONFIG_CONFIG_TYPE_MUST_BE_A_STRING
**Message:** configType must be a string 

### PLT_CONFIG_ADD_A_MODULE_PROPERTY_TO_THE_CONFIG_OR_ADD_A_KNOWN_SCHEMA
**Message:** Add a module property to the config or add a known $schema. 

### PLT_CONFIG_VERSION_MISMATCH
**Message:** Version mismatch. You are running Platformatic %s but your app requires %s 

### PLT_CONFIG_INVALID_CONFIG_FILE_EXTENSION
**Message:** Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported. 

### PLT_CONFIG_NO_CONFIG_FILE_FOUND
**Message:** no config file found 

### PLT_CONFIG_VERSION_MISSING
**Message:** version is required if upgrade is specified. 

## @platformatic/db 

### PLT_DB_MIGRATE_ERROR
**Message:** Missing "migrations" section in config file 

### PLT_DB_UNKNOWN_DATABASE_ERROR
**Message:** Unknown database 

### PLT_DB_MIGRATE_ERROR
**Message:** Migrations directory %s does not exist 

### PLT_DB_MISSING_SEED_FILE_ERROR
**Message:** Missing seed file 

### PLT_DB_MIGRATIONS_TO_APPLY_ERROR
**Message:** You have migrations to apply.

## @platformatic/db-authorization 

### PLT_DB_AUTH_UNAUTHORIZED
**Message:** operation not allowed 

### PLT_DB_AUTH_FIELD_UNAUTHORIZED
**Message:** field not allowed: %s 

### PLT_DB_AUTH_NOT_NULLABLE_MISSING
**Message:** missing not nullable field: "%s" in save rule for entity "%s" 

## @platformatic/db-core 

**No errors defined** 

## @platformatic/runtime 

### PLT_RUNTIME_EADDR_IN_USE
**Message:** The current port is in use by another application 

### PLT_RUNTIME_RUNTIME_EXIT
**Message:** The runtime exited before the operation completed 

### PLT_RUNTIME_UNKNOWN_RUNTIME_API_COMMAND
**Message:** Unknown Runtime API command "%s" 

### PLT_RUNTIME_SERVICE_NOT_FOUND
**Message:** Service not found. Available services are: %s 

### PLT_RUNTIME_SERVICE_WORKER_NOT_FOUND
**Message:** Service %s worker %s not found 

### PLT_RUNTIME_SERVICE_NOT_STARTED
**Message:** Service with id '%s' is not started 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA
**Message:** Failed to retrieve OpenAPI schema for service with id "%s": %s 

### PLT_RUNTIME_FAILED_TO_RETRIEVE_GRAPHQL_SCHEMA
**Message:** Failed to retrieve GraphQL schema for service with id "%s": %s 

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

### PLT_RUNTIME_CANNOT_REMOVE_SERVICE_ON_UPDATE
**Message:** Cannot remove service "%s" when updating a Runtime 

## @platformatic/service 

**No errors defined** 

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

## @platformatic/sql-openapi 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP
**Message:** Unable to create the route for the reverse relationship 

### PLT_SQL_OPENAPI_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP
**Message:** Unable to create the route for the PK col relationship 

## @platformatic/sql-graphql 

### PLT_SQL_GRAPHQL_UNABLE_GENERATE_GRAPHQL_ENUM_TYPE
**Message:** Unable to generate GraphQLEnumType 

### PLT_SQL_GRAPHQL_UNSUPPORTED_KIND
**Message:** Unsupported kind: %s 

### PLT_SQL_GRAPHQL_ERROR_PRINTING_GRAPHQL_SCHEMA
**Message:** Error printing the GraphQL schema 

## @platformatic/sql-events 

### PLT_SQL_EVENTS_OBJECT_IS_REQUIRED_UNDER_THE_DATA_PROPERTY
**Message:** The object that will be published is required under the data property 

### PLT_SQL_EVENTS_PRIMARY_KEY_IS_NECESSARY_INSIDE_DATA
**Message:** The primaryKey is necessary inside data 

### PLT_SQL_EVENTS_NO_SUCH_ACTION
**Message:** No such action %s 

## @platformatic/sql-json-schema-mapper 

**No errors defined** 

## @platformatic/telemetry 

**No errors defined** 

## @platformatic/utils 

### PLT_SQL_UTILS_PATH_OPTION_REQUIRED
**Message:** path option is required 

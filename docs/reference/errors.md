# Platformatic Errors 

## @platformatic/authenticate 

### PLT_AUTHENTICATE_UNABLE_TO_CONTACT_LOGIN_SERVICE
**Message:** Unable to contact login service 

### PLT_AUTHENTICATE_UNABLE_TO_RETRIEVE_TOKENS
**Message:** Unable to retrieve tokens 

### PLT_AUTHENTICATE_USER_DID_NOT_AUTHENTICATE_BEFORE_EXPIRY
**Message:** User did not authenticate before expiry 

### PLT_AUTHENTICATE_CONFIG_OPTION_REQUIRES_PATH_TO_FILE
**Message:** --config option requires path to a file 

### PLT_AUTHENTICATE_UNABLE_TO_GET_USER_DATA
**Message:** Unable to get user data 

### PLT_AUTHENTICATE_UNABLE_TO_CLAIM_INVITE
**Message:** Unable to claim invite 

### PLT_AUTHENTICATE_MISSING_INVITE
**Message:** Missing invite 

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

### PLT_CONFIG_NO_CONFIG_FILE_FOUND
**Message:** no config file found 

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
**Message:** You have migrations to apply. Please run `platformatic db migrations apply` first. 

## @platformatic/db-authorization 

### PLT_DB_AUTH_UNAUTHORIZED
**Message:** operation not allowed 

### PLT_DB_AUTH_FIELD_UNAUTHORIZED
**Message:** field not allowed: %s 

### PLT_DB_AUTH_NOT_NULLABLE_MISSING
**Message:** missing not nullable field: "%s" in save rule for entity "%s" 

## @platformatic/db-core 

**No errors defined** 

## @platformatic/deploy-client 

### PLT_SQL_DEPLOY_CLIENT_REQUEST_FAILED
**Message:** Request failed with status code: %s %s 

### PLT_SQL_DEPLOY_CLIENT_COULD_NOT_MAKE_PREWARM_CALL
**Message:** Could not make a prewarm call: %s 

### PLT_SQL_DEPLOY_CLIENT_INVALID_PLATFORMATIC_WORKSPACE_KEY
**Message:** Invalid platformatic_workspace_key provided 

### PLT_SQL_DEPLOY_CLIENT_COULD_NOT_CREATE_BUNDLE
**Message:** Could not create a bundle: %s 

### PLT_SQL_DEPLOY_CLIENT_FAILED_TO_UPLOAD_CODE_ARCHIVE
**Message:** Failed to upload code archive: %s 

### PLT_SQL_DEPLOY_CLIENT_COULD_NOT_CREATE_DEPLOYMENT
**Message:** Could not create a deployment: %s 

### PLT_SQL_DEPLOY_CLIENT_MISSING_CONFIG_FILE
**Message:** Missing config file! 

## @platformatic/metaconfig 

### PLT_SQL_METACONFIG_MISSING_FILE_OR_CONFIG
**Message:** missing file or config to analyze 

### PLT_SQL_METACONFIG_MISSING_SCHEMA
**Message:** missing $schema, unable to determine the version 

### PLT_SQL_METACONFIG_UNABLE_TO_DETERMINE_VERSION
**Message:** unable to determine the version 

### PLT_SQL_METACONFIG_INVALID_CONFIG_FILE_EXTENSION
**Message:** Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported. 

## @platformatic/runtime 

### PLT_SQL_RUNTIME_RUNTIME_EXIT
**Message:** The runtime exited before the operation completed 

### PLT_SQL_RUNTIME_UNKNOWN_RUNTIME_API_COMMAND
**Message:** Unknown Runtime API command "%s" 

### PLT_SQL_RUNTIME_SERVICE_NOT_FOUND
**Message:** Service with id '%s' not found 

### PLT_SQL_RUNTIME_SERVICE_NOT_STARTED
**Message:** Service with id '%s' is not started 

### PLT_SQL_RUNTIME_FAILED_TO_RETRIEVE_OPENAPI_SCHEMA
**Message:** Failed to retrieve OpenAPI schema for service with id "%s": %s 

### PLT_SQL_RUNTIME_APPLICATION_ALREADY_STARTED
**Message:** Application is already started 

### PLT_SQL_RUNTIME_APPLICATION_NOT_STARTED
**Message:** Application has not been started 

### PLT_SQL_RUNTIME_CONFIG_PATH_MUST_BE_STRING
**Message:** Config path must be a string 

### PLT_SQL_RUNTIME_NO_CONFIG_FILE_FOUND
**Message:** No config file found for service '%s' 

### PLT_SQL_RUNTIME_INVALID_ENTRYPOINT
**Message:** Invalid entrypoint: '%s' does not exist 

### PLT_SQL_RUNTIME_MISSING_DEPENDENCY
**Message:** Missing dependency: "%s" 

### PLT_SQL_RUNTIME_INSPECT_AND_INSPECT_BRK
**Message:** --inspect and --inspect-brk cannot be used together 

### PLT_SQL_RUNTIME_INSPECTOR_PORT
**Message:** Inspector port must be 0 or in range 1024 to 65535 

### PLT_SQL_RUNTIME_INSPECTOR_HOST
**Message:** Inspector host cannot be empty 

### PLT_SQL_RUNTIME_CANNOT_MAP_SPECIFIER_TO_ABSOLUTE_PATH
**Message:** Cannot map "%s" to an absolute path 

### PLT_SQL_RUNTIME_NODE_INSPECTOR_FLAGS_NOT_SUPPORTED
**Message:** The Node.js inspector flags are not supported. Please use 'platformatic start --inspect' instead. 

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

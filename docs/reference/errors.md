# Platformatic Errors 

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

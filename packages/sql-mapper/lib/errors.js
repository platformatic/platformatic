'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_MAPPER'

module.exports = {
  CannotFindEntityError: createError(`${ERROR_PREFIX}_CANNOT_FIND_ENTITY`, 'Cannot find entity %s'),
  SpecifyProtocolError: createError(`${ERROR_PREFIX}_SPECIFY_PROTOCOLS`, 'You must specify either postgres, mysql or sqlite as protocols'),
  ConnectionStringRequiredError: createError(`${ERROR_PREFIX}_CONNECTION_STRING_REQUIRED`, 'connectionString is required'),
  TableMustBeAStringError: createError(`${ERROR_PREFIX}_TABLE_MUST_BE_A_STRING`, 'Table must be a string, got %s'),
  UnknownFieldError: createError(`${ERROR_PREFIX}_UNKNOWN_FIELD`, 'Unknown field %s'),
  InputNotProvidedError: createError(`${ERROR_PREFIX}_INPUT_NOT_PROVIDED`, 'Input not provided.'),
  UnsupportedWhereClauseError: createError(`${ERROR_PREFIX}_UNSUPPORTED_WHERE_CLAUSE`, 'Unsupported where clause %s'),
  UnsupportedOperatorForArrayFieldError: createError(`${ERROR_PREFIX}_UNSUPPORTED_OPERATOR`, 'Unsupported operator for Array field'),
  UnsupportedOperatorForNonArrayFieldError: createError(`${ERROR_PREFIX}_UNSUPPORTED_OPERATOR_FOR_NON_ARRAY`, 'Unsupported operator for non Array field'),
  ParamNotAllowedError: createError(`${ERROR_PREFIX}_PARAM_NOT_ALLOWED`, 'Param offset=%s not allowed. It must be not negative value.'),
  InvalidPrimaryKeyTypeError: createError(`${ERROR_PREFIX}_INVALID_PRIMARY_KEY_TYPE`, 'Invalid Primary Key type: "%s". We support the following: %s'),
  ParamLimitNotAllowedError: createError(`${ERROR_PREFIX}_PARAM_LIMIT_NOT_ALLOWED`, 'Param limit=%s not allowed. Max accepted value %s.'),
  ParamLimitMustBeNotNegativeError: createError(`${ERROR_PREFIX}_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE`, 'Param limit=%s not allowed. It must be a not negative value.'),
  MissingValueForPrimaryKeyError: createError(`${ERROR_PREFIX}_MISSING_VALUE_FOR_PRIMARY_KEY`, 'Missing value for primary key %s'),
  SQLiteOnlySupportsAutoIncrementOnOneColumnError: createError(`${ERROR_PREFIX}_SQLITE_ONLY_SUPPORTS_AUTO_INCREMENT_ON_ONE_COLUMN`, 'SQLite only supports autoIncrement on one column')
}

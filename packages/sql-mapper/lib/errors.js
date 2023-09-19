'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_MAPPER'

// We need to ignore this because some of the errors are actually not thrown
// in tests (but coverage is still 100% because in "ignored" code).
/* istanbul ignore next */
module.exports = {
  CannotFindEntityError: function (entityName) { return createError(`${ERROR_PREFIX}_CANNOT_FIND_ENTITY`, 'Cannot find entity %s')(entityName) },
  SpecifyProtocolError: function () { return createError(`${ERROR_PREFIX}_SPECIFY_PROTOCOLS`, 'You must specify either postgres, mysql or sqlite as protocols')() },
  ConnectionStringRequiredError: function () { return createError(`${ERROR_PREFIX}_CONNECTION_STRING_REQUIRED`, 'connectionString is required')() },
  TableMustBeAStringError: function (table) { return createError(`${ERROR_PREFIX}_TABLE_MUST_BE_A_STRING`, 'Table must be a string, got %s')(table) },
  UnknownFieldError: function (key) { return createError(`${ERROR_PREFIX}_UNKNOWN_FIELD`, 'Unknown field %s')(key) },
  InputNotProvidedError: function () { return createError(`${ERROR_PREFIX}_INPUT_NOT_PROVIDED`, 'Input not provided.')() },
  UnsupportedWhereClauseError: function (where) { return createError(`${ERROR_PREFIX}_UNSUPPORTED_WHERE_CLAUSE`, 'Unsupported where clause %s')(where) },
  UnsupportedOperatorForArrayFieldError: function () { return createError(`${ERROR_PREFIX}_UNSUPPORTED_OPERATOR`, 'Unsupported operator for Array field')() },
  UnsupportedOperatorForNonArrayFieldError: function () { return createError(`${ERROR_PREFIX}_UNSUPPORTED_OPERATOR_FOR_NON_ARRAY`, 'Unsupported operator for non Array field')() },
  ParamNotAllowedError: function (offset) { return createError(`${ERROR_PREFIX}_PARAM_NOT_ALLOWED`, 'Param offset=%s not allowed. It must be not negative value.')(offset) },
  InvalidPrimaryKeyTypeError: function (pkType, validTypes) { return createError(`${ERROR_PREFIX}_INVALID_PRIMARY_KEY_TYPE`, 'Invalid Primary Key type: "%s". We support the following: %s')(pkType, validTypes) },
  ParamLimitNotAllowedError: function (limit, max) { return createError(`${ERROR_PREFIX}_PARAM_LIMIT_NOT_ALLOWED`, 'Param limit=%s not allowed. Max accepted value %s.')(limit, max) },
  ParamLimitMustBeNotNegativeError: function (limit) { return createError(`${ERROR_PREFIX}_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE`, 'Param limit=%s not allowed. It must be a not negative value.')(limit) },
  MissingValueForPrimaryKeyError: function (key) { return createError(`${ERROR_PREFIX}_MISSING_VALUE_FOR_PRIMARY_KEY`, 'Missing value for primary key %s')(key) },
  SQLiteOnlySupportsAutoIncrementOnOneColumnError: function () { return createError(`${ERROR_PREFIX}_SQLITE_ONLY_SUPPORTS_AUTO_INCREMENT_ON_ONE_COLUMN`, 'SQLite only supports autoIncrement on one column')() }

}

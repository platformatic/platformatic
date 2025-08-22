import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_SQL_MAPPER'

export const CannotFindEntityError = createError(`${ERROR_PREFIX}_CANNOT_FIND_ENTITY`, 'Cannot find entity %s')
export const SpecifyProtocolError = createError(
  `${ERROR_PREFIX}_SPECIFY_PROTOCOLS`,
  'You must specify either postgres, mysql or sqlite as protocols'
)
export const ConnectionStringRequiredError = createError(
  `${ERROR_PREFIX}_CONNECTION_STRING_REQUIRED`,
  'connectionString is required'
)
export const TableMustBeAStringError = createError(
  `${ERROR_PREFIX}_TABLE_MUST_BE_A_STRING`,
  'Table must be a string, got %s'
)
export const UnknownFieldError = createError(`${ERROR_PREFIX}_UNKNOWN_FIELD`, 'Unknown field %s')
export const InputNotProvidedError = createError(`${ERROR_PREFIX}_INPUT_NOT_PROVIDED`, 'Input not provided.')
export const UnsupportedWhereClauseError = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_WHERE_CLAUSE`,
  'Unsupported where clause %s'
)
export const UnsupportedOperatorForArrayFieldError = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_OPERATOR`,
  'Unsupported operator for Array field'
)
export const UnsupportedOperatorForNonArrayFieldError = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_OPERATOR_FOR_NON_ARRAY`,
  'Unsupported operator for non Array field'
)
export const ParamNotAllowedError = createError(
  `${ERROR_PREFIX}_PARAM_NOT_ALLOWED`,
  'Param offset=%s not allowed. It must be not negative value.'
)
export const InvalidPrimaryKeyTypeError = createError(
  `${ERROR_PREFIX}_INVALID_PRIMARY_KEY_TYPE`,
  'Invalid Primary Key type: "%s". We support the following: %s'
)
export const ParamLimitNotAllowedError = createError(
  `${ERROR_PREFIX}_PARAM_LIMIT_NOT_ALLOWED`,
  'Param limit=%s not allowed. Max accepted value %s.'
)
export const ParamLimitMustBeNotNegativeError = createError(
  `${ERROR_PREFIX}_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE`,
  'Param limit=%s not allowed. It must be a not negative value.'
)
export const MissingValueForPrimaryKeyError = createError(
  `${ERROR_PREFIX}_MISSING_VALUE_FOR_PRIMARY_KEY`,
  'Missing value for primary key %s'
)
export const MissingWhereClauseError = createError(`${ERROR_PREFIX}_MISSING_WHERE_CLAUSE`, 'Missing where clause', 400)
export const SQLiteOnlySupportsAutoIncrementOnOneColumnError = createError(
  `${ERROR_PREFIX}_SQLITE_ONLY_SUPPORTS_AUTO_INCREMENT_ON_ONE_COLUMN`,
  'SQLite only supports autoIncrement on one column'
)
export const MissingOrderByClauseError = createError(
  `${ERROR_PREFIX}_MISSING_ORDER_BY_CLAUSE`,
  'Missing orderBy clause'
)
export const MissingOrderByFieldForCursorError = createError(
  `${ERROR_PREFIX}_MISSING_ORDER_BY_FIELD_FOR_CURSOR`,
  'Cursor field(s) %s must be included in orderBy'
)
export const MissingUniqueFieldInCursorError = createError(
  `${ERROR_PREFIX}_MISSING_UNIQUE_FIELD_IN_CURSOR`,
  'Cursor must contain at least one primary key field'
)

import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_SQL_OPENAPI'

export const UnableToCreateTheRouteForTheReverseRelationshipError = createError(
  `${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP`,
  'Unable to create the route for the reverse relationship'
)
export const UnableToCreateTheRouteForThePKColRelationshipError = createError(
  `${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP`,
  'Unable to create the route for the PK col relationship'
)
export const UnableToParseCursorStrError = createError(
  `${ERROR_PREFIX}_UNABLE_TO_PARSE_CURSOR_STR`,
  'Unable to parse cursor string. Make sure to provide valid encoding of cursor object. Error: %s',
  400
)
export const CursorValidationError = createError(
  `${ERROR_PREFIX}_CURSOR_VALIDATION_ERROR`,
  'Cursor validation error. %s',
  400
)
export const PrimaryKeyNotIncludedInOrderByInCursorPaginationError = createError(
  `${ERROR_PREFIX}_PRIMARY_KEY_NOT_INCLUDED_IN_ORDER_BY_IN_CURSOR_PAGINATION`,
  'At least one primary key must be included in orderBy clause in case of cursor pagination',
  400
)

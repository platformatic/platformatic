'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_OPENAPI'

module.exports = {
  UnableToCreateTheRouteForTheReverseRelationshipError: createError(`${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP`, 'Unable to create the route for the reverse relationship'),
  UnableToCreateTheRouteForThePKColRelationshipError: createError(`${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP`, 'Unable to create the route for the PK col relationship'),
  UnableToDecodeCursor: createError(`${ERROR_PREFIX}_UNABLE_TO_DECODE_CURSOR`, 'Unable to decode cursor. Make sure to provide valid base64url encoded json string', 400),
  PrimaryKeyNotIncludedInOrderByInCursorPaginationError: createError(`${ERROR_PREFIX}_PRIMARY_KEY_NOT_INCLUDED_IN_ORDER_BY_IN_CURSOR_PAGINATION`, 'At least one primary key must be included in orderBy clause in case of cursor pagination', 400),
}

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_OPENAPI'

module.exports = {
  UnableToCreateTheRouteForTheReverseRelationshipError: createError(`${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_REVERSE_RELATIONSHIP`, 'Unable to create the route for the reverse relationship'),
  UnableToCreateTheRouteForThePKColRelationshipError: createError(`${ERROR_PREFIX}_UNABLE_CREATE_ROUTE_FOR_PK_COL_RELATIONSHIP`, 'Unable to create the route for the PK col relationship')
}

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_GRAPHQL'

module.exports = {
  UnableToGenerateGraphQLEnumTypeError: createError(`${ERROR_PREFIX}_UNABLE_GENERATE_GRAPHQL_ENUM_TYPE`, 'Unable to generate GraphQLEnumType'),
  UnsupportedKindError: createError(`${ERROR_PREFIX}_UNSUPPORTED_KIND`, 'Unsupported kind: %s'),
  ErrorPrintingGraphQLSchema: createError(`${ERROR_PREFIX}_ERROR_PRINTING_GRAPHQL_SCHEMA`, 'Error printing the GraphQL schema')
}

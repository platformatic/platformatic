import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_SQL_GRAPHQL'

export const UnableToGenerateGraphQLEnumTypeError = createError(
  `${ERROR_PREFIX}_UNABLE_GENERATE_GRAPHQL_ENUM_TYPE`,
  'Unable to generate GraphQLEnumType'
)
export const UnsupportedKindError = createError(`${ERROR_PREFIX}_UNSUPPORTED_KIND`, 'Unsupported kind: %s')
export const ErrorPrintingGraphQLSchema = createError(
  `${ERROR_PREFIX}_ERROR_PRINTING_GRAPHQL_SCHEMA`,
  'Error printing the GraphQL schema'
)

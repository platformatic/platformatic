import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_COMPOSER'

export const FastifyInstanceIsAlreadyListeningError = createError(
  `${ERROR_PREFIX}_FASTIFY_INSTANCE_IS_ALREADY_LISTENING`,
  'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!'
)
export const FailedToFetchOpenAPISchemaError = createError(
  `${ERROR_PREFIX}_FAILED_TO_FETCH_OPENAPI_SCHEMA`,
  'Failed to fetch OpenAPI schema from %s'
)
export const ValidationErrors = createError(`${ERROR_PREFIX}_VALIDATION_ERRORS`, 'Validation errors: %s')
export const PathAlreadyExistsError = createError(`${ERROR_PREFIX}_PATH_ALREADY_EXISTS`, 'Path "%s" already exists')
export const CouldNotReadOpenAPIConfigError = createError(
  `${ERROR_PREFIX}_COULD_NOT_READ_OPENAPI_CONFIG`,
  'Could not read openapi config for "%s" application'
)

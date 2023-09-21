'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_COMPOSER'

module.exports = {
  FastifyInstanceIsAlreadyListeningError: createError(`${ERROR_PREFIX}_FASTIFY_INSTANCE_IS_ALREADY_LISTENING`, 'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!'),
  FailedToFetchOpenAPISchemaError: createError(`${ERROR_PREFIX}_FAILED_TO_FETCH_OPENAPI_SCHEMA`, 'Failed to fetch OpenAPI schema from %s'),
  ValidationErrors: createError(`${ERROR_PREFIX}_VALIDATION_ERRORS`, 'Validation errors: %s'),
  PathAlreadyExistsError: createError(`${ERROR_PREFIX}_PATH_ALREADY_EXISTS`, 'Path "%s" already exists'),
  CouldNotReadOpenAPIConfigError: createError(`${ERROR_PREFIX}_COULD_NOT_READ_OPENAPI_CONFIG`, 'Could not read openapi config for "%s" service')

}

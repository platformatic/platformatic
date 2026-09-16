import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_SERVICE'

export const InvalidErrorHandlerError = createError(
  `${ERROR_PREFIX}_INVALID_ERROR_HANDLER`,
  'The module %s configured as server.errorHandler does not export a function.'
)

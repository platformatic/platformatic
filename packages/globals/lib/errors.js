import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_GLOBALS'

export const MissingGlobalError = createError(
  `${ERROR_PREFIX}_MISSING_FIELD`,
  'Global runtime API "%s" is not available'
)

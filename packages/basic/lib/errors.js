import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_BASIC'

export const UnsupportedVersion = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_VERSION`,
  '%s version %s is not supported. Please use version %s.'
)

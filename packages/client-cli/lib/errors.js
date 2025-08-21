import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_CLIENT_CLI'

export const UnknownTypeError = createError(`${ERROR_PREFIX}_UNKNOWN_TYPE`, 'Unknown type %s')
export const TypeNotSupportedError = createError(`${ERROR_PREFIX}_TYPE_NOT_SUPPORTED`, 'Type %s not supported')

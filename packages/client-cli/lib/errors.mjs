'use strict'

import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_CLIENT_CLI'

const errors = {
  UknonwnTypeError: createError(`${ERROR_PREFIX}_UNKNOWN_TYPE`, 'Unknown type %s'),
  TypeNotSupportedError: createError(`${ERROR_PREFIX}_TYPE_NOT_SUPPORTED`, 'Type %s not supported')
}

export default errors

'use strict'

import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_CLIENT_CLI'

const errors = {
  UnknownTypeError: createError(`${ERROR_PREFIX}_UNKNOWN_TYPE`, 'Unknown type %s')
}

export default errors

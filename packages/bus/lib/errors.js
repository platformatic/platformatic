'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_BUS'

module.exports = {
  InvalidArgument: createError(
    `${ERROR_PREFIX}_INVALID_ARGUMENT`,
    'Invalid %s argument'
  )
}

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_PS'

module.exports = {
  RuntimeNotFound: createError(`${ERROR_PREFIX}_RUNTIME_NOT_FOUND`, 'Runtime not found.'),
  MissingRuntimeIdentifier: createError(`${ERROR_PREFIX}_MISSING_RUNTIME_IDENTIFIER`, 'Runtime name or PID is required.'),
  MissingRequestURL: createError(`${ERROR_PREFIX}_MISSING_REQUEST_URL`, 'Request URL is required.')
}

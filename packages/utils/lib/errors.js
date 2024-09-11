'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_UTILS'

function ensureLoggableError (error) {
  Reflect.defineProperty(error, 'message', { enumerable: true })

  if ('code' in error) {
    Reflect.defineProperty(error, 'code', { enumerable: true })
  }

  if ('stack' in error) {
    Reflect.defineProperty(error, 'stack', { enumerable: true })
  }

  return error
}

module.exports = {
  ensureLoggableError,
  PathOptionRequiredError: createError(`${ERROR_PREFIX}_PATH_OPTION_REQUIRED`, 'path option is required')
}

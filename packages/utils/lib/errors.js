'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_UTILS'

module.exports = {
  PathOptionRequiredError: createError(`${ERROR_PREFIX}_PATH_OPTION_REQUIRED`, 'path option is required')
}

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SERVICE'

module.exports = {
  VersionNotSpecified: createError(
    `${ERROR_PREFIX}_VERSION_NOT_SPECIFIED_ERROR`,
    'Version not specified. Use --version option to specify a version.'
  ),
  VersionAlreadyExists: createError(
    `${ERROR_PREFIX}_VERSION_EXISTS_ERROR`,
    'Version %s already exists.'
  )
}

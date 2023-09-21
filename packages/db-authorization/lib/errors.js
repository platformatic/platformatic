'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_DB_AUTH'

module.exports = {
  Unauthorized: createError(`${ERROR_PREFIX}_UNAUTHORIZED`, 'operation not allowed', 401),
  UnauthorizedField: createError(`${ERROR_PREFIX}_FIELD_UNAUTHORIZED`, 'field not allowed: %s', 401),
  MissingNotNullableError: createError(`${ERROR_PREFIX}_NOT_NULLABLE_MISSING`, 'missing not nullable field: "%s" in save rule for entity "%s"')
}

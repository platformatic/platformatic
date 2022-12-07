'use strict'

const createError = require('@fastify/error')

const Unauthorized = createError('PLT_DB_AUTH_UNAUTHORIZED', 'operation not allowed', 401)
const UnauthorizedField = createError('PLT_DB_AUTH_UNAUTHORIZED', 'field not allowed: %s', 401)
const MissingNotNullableError = createError('PLT_DB_AUTH_NOT_NULLABLE_MISSING', 'missing not nullable field: "%s" in save rule for entity "%s"')

module.exports = {
  Unauthorized,
  UnauthorizedField,
  MissingNotNullableError
}

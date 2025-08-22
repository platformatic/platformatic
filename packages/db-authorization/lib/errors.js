import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_DB_AUTH'

export const Unauthorized = createError(`${ERROR_PREFIX}_UNAUTHORIZED`, 'operation not allowed', 401)
export const UnauthorizedField = createError(`${ERROR_PREFIX}_FIELD_UNAUTHORIZED`, 'field not allowed: %s', 401)
export const MissingNotNullableError = createError(
  `${ERROR_PREFIX}_NOT_NULLABLE_MISSING`,
  'missing not nullable field: "%s" in save rule for entity "%s"'
)

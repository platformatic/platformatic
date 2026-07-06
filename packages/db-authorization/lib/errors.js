import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_DB_AUTH'

// The operation is not allowed for the (possibly anonymous) user: this is
// 403 Forbidden, not 401 Unauthorized, which is reserved for requests with
// missing or invalid authentication.
// The error codes keep the historical UNAUTHORIZED name for backward compatibility.
export const Unauthorized = createError(`${ERROR_PREFIX}_UNAUTHORIZED`, 'operation not allowed', 403)
export const UnauthorizedField = createError(`${ERROR_PREFIX}_FIELD_UNAUTHORIZED`, 'field not allowed: %s', 403)
export const MissingNotNullableError = createError(
  `${ERROR_PREFIX}_NOT_NULLABLE_MISSING`,
  'missing not nullable field: "%s" in save rule for entity "%s"'
)

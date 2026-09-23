import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_GLOBALS'

export const MissingGlobalError = createError(
  `${ERROR_PREFIX}_MISSING_FIELD`,
  'Global runtime API "%s" is not available'
)

export const InvalidCloseCallbackError = createError(
  `${ERROR_PREFIX}_INVALID_CLOSE_CALLBACK`,
  'The close callback must be a function or an object implementing Symbol.asyncDispose'
)

export const CloseCallbackRegistrationClosedError = createError(
  `${ERROR_PREFIX}_CLOSE_CALLBACK_REGISTRATION_CLOSED`,
  'Close callbacks cannot be registered after callback execution has started'
)

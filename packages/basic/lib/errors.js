import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_BASIC'

export const exitCodes = {
  MANAGER_MESSAGE_HANDLING_FAILED: 11,
  MANAGER_SOCKET_ERROR: 11,
  PROCESS_UNHANDLED_ERROR: 20,
  PROCESS_MESSAGE_HANDLING_FAILED: 21,
  PROCESS_SOCKET_ERROR: 22
}

export const UnsupportedVersion = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_VERSION`,
  '%s version %s is not supported. Please use version %s.'
)

export const NonZeroExitCode = createError(
  `${ERROR_PREFIX}_NON_ZERO_EXIT_CODE`,
  'Process exited with non zero exit code %d.'
)

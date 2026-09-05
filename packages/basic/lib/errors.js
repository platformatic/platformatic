import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_BASIC'

// Keep in sync with packages/runtime/lib/errors.js
export const exitCodes = {
  MANAGER_MESSAGE_HANDLING_FAILED: 11,
  MANAGER_SOCKET_ERROR: 11,
  PROCESS_UNHANDLED_ERROR: 20,
  PROCESS_MESSAGE_HANDLING_FAILED: 21,
  PROCESS_SOCKET_ERROR: 22
}

export const CapabilityFactoryKeyCollisionError = createError(
  `${ERROR_PREFIX}_CAPABILITY_FACTORY_KEY_COLLISION`,
  "%s cannot flatten '%s' from the %s block: it already collides with %s."
)

export const CapabilityFactoryOptionsRequiredError = createError(
  `${ERROR_PREFIX}_CAPABILITY_FACTORY_OPTIONS_REQUIRED`,
  'defineCapabilityFactory requires the capability module name as its first argument.'
)

export const UnsupportedVersion = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_VERSION`,
  '%s version %s is not supported. Please use version %s.'
)

export const NonZeroExitCode = createError(
  `${ERROR_PREFIX}_NON_ZERO_EXIT_CODE`,
  'Process exited with non zero exit code %d.'
)

export const ScheduledTaskGroupNotFound = createError(
  `${ERROR_PREFIX}_SCHEDULED_TASK_GROUP_NOT_FOUND`,
  'Scheduled task group "%s" not found'
)

export const ScheduledTaskNotFound = createError(
  `${ERROR_PREFIX}_SCHEDULED_TASK_NOT_FOUND`,
  'Scheduled task "%s" not found'
)

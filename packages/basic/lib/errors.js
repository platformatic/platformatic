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

const UnsupportedVersionError = createError(
  `${ERROR_PREFIX}_UNSUPPORTED_VERSION`,
  '%s version %s is not supported. Please use version %s.'
)

// Supported versions can be a list of ranges, which would otherwise be printed as an array literal
export function UnsupportedVersion (name, version, supportedVersions) {
  if (Array.isArray(supportedVersions)) {
    supportedVersions = new Intl.ListFormat('en', { type: 'disjunction' }).format(supportedVersions)
  }

  return new UnsupportedVersionError(name, version, supportedVersions)
}

// Keep instanceof checks working when the error is created via new UnsupportedVersion()
UnsupportedVersion.prototype = UnsupportedVersionError.prototype

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

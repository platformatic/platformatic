'use strict'

import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_CLI'

const errors = {
  InvalidWorkspaceTypeError: createError(`${ERROR_PREFIX}_INVALID_WORKSPACE_TYPE`, 'Invalid workspace type provided: "%s". Type must be one of: %s'),
  InvalidWorkspaceIdError: createError(`${ERROR_PREFIX}_INVALID_WORKSPACE_ID`, 'Invalid workspace id provided. Workspace id must be a valid uuid.'),
  CouldNotFindWorkspaceKeysError: createError(`${ERROR_PREFIX}_COULD_NOT_FIND_WORKSPACE_KEYS`, 'Could not find workspace keys in provided file.')
}

export default errors

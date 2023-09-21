'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_DEPLOY_CLIENT'

module.exports = {
  RequestFailedError: createError(`${ERROR_PREFIX}_REQUEST_FAILED`, 'Request failed with status code: %s %s'),
  CouldNotMakePrewarmCallError: createError(`${ERROR_PREFIX}_COULD_NOT_MAKE_PREWARM_CALL`, 'Could not make a prewarm call: %s'),
  InvalidPlatformaticWorkspaceKeyError: createError(`${ERROR_PREFIX}_INVALID_PLATFORMATIC_WORKSPACE_KEY`, 'Invalid platformatic_workspace_key provided'),
  CouldNotCreateBundleError: createError(`${ERROR_PREFIX}_COULD_NOT_CREATE_BUNDLE`, 'Could not create a bundle: %s'),
  FailedToUploadCodeArchiveError: createError(`${ERROR_PREFIX}_FAILED_TO_UPLOAD_CODE_ARCHIVE`, 'Failed to upload code archive: %s'),
  CouldNotCreateDeploymentError: createError(`${ERROR_PREFIX}_COULD_NOT_CREATE_DEPLOYMENT`, 'Could not create a deployment: %s'),
  MissingConfigFileError: createError(`${ERROR_PREFIX}_MISSING_CONFIG_FILE`, 'Missing config file!')
}

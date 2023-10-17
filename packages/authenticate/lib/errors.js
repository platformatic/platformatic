'use strict'

import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_AUTHENTICATE'

const errors = {
  UnableToContactLoginServiceError: createError(`${ERROR_PREFIX}_UNABLE_TO_CONTACT_LOGIN_SERVICE`, 'Unable to contact login service'),
  UnableToRetrieveTokensError: createError(`${ERROR_PREFIX}_UNABLE_TO_RETRIEVE_TOKENS`, 'Unable to retrieve tokens'),
  UserDidNotAuthenticateBeforeExpiryError: createError(`${ERROR_PREFIX}_USER_DID_NOT_AUTHENTICATE_BEFORE_EXPIRY`, 'User did not authenticate before expiry'),
  ConfigOptionRequiresPathToFileError: createError(`${ERROR_PREFIX}_CONFIG_OPTION_REQUIRES_PATH_TO_FILE`, '--config option requires path to a file'),

  UnableToGetUserDataError: createError(`${ERROR_PREFIX}_UNABLE_TO_GET_USER_DATA`, 'Unable to get user data'),
  UnableToClaimInviteError: createError(`${ERROR_PREFIX}_UNABLE_TO_CLAIM_INVITE`, 'Unable to claim invite'),
  MissingInviteError: createError(`${ERROR_PREFIX}_MISSING_INVITE`, 'Missing invite')
}

export default errors

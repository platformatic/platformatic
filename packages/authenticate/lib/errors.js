'use strict'

import createError from '@fastify/error'

const ERROR_PREFIX = 'PLT_AUTHENTICATE'

const errors = {
  UnableToContactLoginServiceError: createError(`${ERROR_PREFIX}_UNABLE_TO_CONTACT_LOGIN_SERVICE`, 'Unable to contact login service'),
  UnknownMessageTypeError: createError(`${ERROR_PREFIX}_UNKNOWN_MESSAGE_TYPE`, 'Received unknown message type from login service: %s'),
  ConfigOptionRequiresPathToFileError: createError(`${ERROR_PREFIX}_CONFIG_OPTION_REQUIRES_PATH_TO_FILE`, '--config option requires path to a file')
}

export default errors

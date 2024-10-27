'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_CLIENT'

module.exports = {
  OptionsUrlRequiredError: createError(`${ERROR_PREFIX}_OPTIONS_URL_REQUIRED`, 'options.url is required'),
  FormDataRequiredError: createError(`${ERROR_PREFIX}_FORM_DATA_REQUIRED`, 'Operation %s should be called with a undici.FormData as payload')
}

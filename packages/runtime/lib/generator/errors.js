'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_RUNTIME_GEN'

module.exports = {
  NoServiceNamedError: createError(`${ERROR_PREFIX}_NO_SERVICE_FOUND`, 'No service named \'%s\' has been added to this runtime.'),
  NoEntryPointError: createError(`${ERROR_PREFIX}_NO_ENTRYPOINT`, 'No entrypoint had been deinfed.')
}

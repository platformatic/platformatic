'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_EVENTS'

module.exports = {
  ObjectRequiredUnderTheDataProperty: createError(`${ERROR_PREFIX}_OBJECT_IS_REQUIRED_UNDER_THE_DATA_PROPERTY`, 'The object that will be published is required under the data property'),
  PrimaryKeyIsNecessaryInsideData: createError(`${ERROR_PREFIX}_PRIMARY_KEY_IS_NECESSARY_INSIDE_DATA`, 'The primaryKey is necessary inside data'),
  NoSuchActionError: createError(`${ERROR_PREFIX}_NO_SUCH_ACTION`, 'No such action %s')

}

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_GEN'

module.exports = {
  NoQuestionsError: createError(`${ERROR_PREFIX}_NO_QUESTIONS_ERROR`, 'No questions added.'),
  PrepareError: createError(`${ERROR_PREFIX}_PREPARE_ERROR`, 'Error while generating the files: %s.'),
  MissingEnvVariable: createError(`${ERROR_PREFIX}_MISSING_ENV_VAR`, 'Env variable %s is defined in config file %s, but not in config.env object.'),
  WrongTypeError: createError(`${ERROR_PREFIX}_WRONG_TYPE`, 'Invalid value type. Accepted values are \'string\', \'number\' and \'boolean\', found \'%s\'.')
}

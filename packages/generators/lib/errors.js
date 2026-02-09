import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_GEN'

export const ModuleNeeded = createError(
  `${ERROR_PREFIX}_PREPARE_ERROR`,
  'The module which the package will be published to must be specified'
)
export const PrepareError = createError(`${ERROR_PREFIX}_PREPARE_ERROR`, 'Error while generating the files: %s.')
export const MissingEnvVariable = createError(
  `${ERROR_PREFIX}_MISSING_ENV_VAR`,
  'Env variable %s is defined in config file %s, but not in config.env object.'
)
export const WrongTypeError = createError(
  `${ERROR_PREFIX}_WRONG_TYPE`,
  "Invalid value type. Accepted values are 'string', 'number' and 'boolean', found '%s'."
)

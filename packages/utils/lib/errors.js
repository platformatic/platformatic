import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT'

export function ensureLoggableError (error) {
  Reflect.defineProperty(error, 'message', { enumerable: true })

  if ('code' in error) {
    Reflect.defineProperty(error, 'code', { enumerable: true })
  }

  if ('stack' in error) {
    Reflect.defineProperty(error, 'stack', { enumerable: true })
  }

  return error
}

export const PathOptionRequiredError = createError(`${ERROR_PREFIX}_PATH_OPTION_REQUIRED`, 'path option is required')
export const NoConfigFileFoundError = createError(`${ERROR_PREFIX}_NO_CONFIG_FILE_FOUND`, 'no config file found')
export const InvalidConfigFileExtensionError = createError(
  `${ERROR_PREFIX}_INVALID_CONFIG_FILE_EXTENSION`,
  'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.'
)
export const AddAModulePropertyToTheConfigOrAddAKnownSchemaError = createError(
  `${ERROR_PREFIX}_ADD_A_MODULE_PROPERTY_TO_THE_CONFIG_OR_ADD_A_KNOWN_SCHEMA`,
  'Add a module property to the config or add a known $schema.'
)
export const CannotParseConfigFileError = createError(
  `${ERROR_PREFIX}_CANNOT_PARSE_CONFIG_FILE`,
  'Cannot parse config file. %s'
)
export const SourceMissingError = createError(`${ERROR_PREFIX}_SOURCE_MISSING`, 'Source missing.')
export const RootMissingError = createError(
  `${ERROR_PREFIX}_ROOT_MISSING`,
  'Provide the root option to loadConfiguration when using an object as source.'
)
export const SchemaMustBeDefinedError = createError(
  `${ERROR_PREFIX}_SCHEMA_MUST_BE_DEFINED`,
  'schema must be defined',
  undefined,
  TypeError
)
export const ConfigurationDoesNotValidateAgainstSchemaError = createError(
  `${ERROR_PREFIX}_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA`,
  'The configuration does not validate against the configuration schema'
)

'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_CONFIG'

module.exports = {
  ConfigurationDoesNotValidateAgainstSchemaError: createError(`${ERROR_PREFIX}_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA`, 'The configuration does not validate against the configuration schema'),
  SourceMissingError: createError(`${ERROR_PREFIX}_SOURCE_MISSING`, 'Source missing.'),
  InvalidPlaceholderError: createError(`${ERROR_PREFIX}_INVALID_PLACEHOLDER`, '%s is an invalid placeholder. All placeholders must be prefixed with PLT_.\nDid you mean PLT_%s?'),
  EnvVarMissingError: createError(`${ERROR_PREFIX}_ENV_VAR_MISSING`, '%s env variable is missing.'),
  CannotParseConfigFileError: createError(`${ERROR_PREFIX}_CANNOT_PARSE_CONFIG_FILE`, 'Cannot parse config file. %s'),
  ValidationErrors: createError(`${ERROR_PREFIX}_VALIDATION_ERRORS`, 'Validation errors: %s'),
  AppMustBeAFunctionError: createError(`${ERROR_PREFIX}_APP_MUST_BE_A_FUNCTION`, 'app must be a function', undefined, TypeError),
  SchemaMustBeDefinedError: createError(`${ERROR_PREFIX}_SCHEMA_MUST_BE_DEFINED`, 'schema must be defined', undefined, TypeError),
  SchemaIdMustBeAStringError: createError(`${ERROR_PREFIX}_SCHEMA_ID_MUST_BE_A_STRING`, 'schema.$id must be a string with length > 0', undefined, TypeError),
  ConfigTypeMustBeAStringError: createError(`${ERROR_PREFIX}_CONFIG_TYPE_MUST_BE_A_STRING`, 'configType must be a string', undefined, TypeError),
  AddAModulePropertyToTheConfigOrAddAKnownSchemaError: createError(`${ERROR_PREFIX}_ADD_A_MODULE_PROPERTY_TO_THE_CONFIG_OR_ADD_A_KNOWN_SCHEMA`, 'Add a module property to the config or add a known $schema.'),
  VersionMismatchError: createError(`${ERROR_PREFIX}_VERSION_MISMATCH`, 'Version mismatch. You are running Platformatic %s but your app requires %s'),
  NoConfigFileFoundError: createError(`${ERROR_PREFIX}_NO_CONFIG_FILE_FOUND`, 'no config file found')
}

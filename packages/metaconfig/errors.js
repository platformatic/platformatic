'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_SQL_METACONFIG'

module.exports = {
  MissingFileOrConfigError: createError(`${ERROR_PREFIX}_MISSING_FILE_OR_CONFIG`, 'missing file or config to analyze'),
  MissingSchemaError: createError(`${ERROR_PREFIX}_MISSING_SCHEMA`, 'missing $schema, unable to determine the version'),
  UnableToDetermineVersionError: createError(`${ERROR_PREFIX}_UNABLE_TO_DETERMINE_VERSION`, 'unable to determine the version'),
  InvalidConfigFileExtensionError: createError(`${ERROR_PREFIX}_INVALID_CONFIG_FILE_EXTENSION`, 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
}

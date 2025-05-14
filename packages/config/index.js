'use strict'

const { ConfigManager } = require('./lib/manager')
const { Store, matchKnownSchema } = require('./lib/store')
const {
  loadConfig,
  loadEmptyConfig,
  printConfigValidationErrors,
  printAndExitLoadConfigError
} = require('./lib/load-config')
const { getParser, getStringifier } = require('./lib/formats')
const errors = require('./lib/errors')
const { findConfigurationFile, loadConfigurationFile, saveConfigurationFile } = require('./lib/simple')

module.exports = ConfigManager
module.exports.ConfigManager = ConfigManager
module.exports.Store = Store
module.exports.matchKnownSchema = matchKnownSchema
module.exports.loadConfig = loadConfig
module.exports.loadEmptyConfig = loadEmptyConfig
module.exports.printConfigValidationErrors = printConfigValidationErrors
module.exports.printAndExitLoadConfigError = printAndExitLoadConfigError
module.exports.errors = errors
module.exports.getParser = getParser
module.exports.getStringifier = getStringifier
module.exports.findConfigurationFile = findConfigurationFile
module.exports.loadConfigurationFile = loadConfigurationFile
module.exports.saveConfigurationFile = saveConfigurationFile

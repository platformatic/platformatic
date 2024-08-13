'use strict'

const { ConfigManager } = require('./lib/manager')
const { Store } = require('./lib/store')
const {
  loadConfig,
  loadEmptyConfig,
  printConfigValidationErrors,
  printAndExitLoadConfigError,
} = require('./lib/load-config')
const { getParser, getStringifier } = require('./lib/formats')
const errors = require('./lib/errors')

module.exports = ConfigManager
module.exports.ConfigManager = ConfigManager
module.exports.Store = Store
module.exports.loadConfig = loadConfig
module.exports.loadEmptyConfig = loadEmptyConfig
module.exports.printConfigValidationErrors = printConfigValidationErrors
module.exports.printAndExitLoadConfigError = printAndExitLoadConfigError
module.exports.errors = errors
module.exports.getParser = getParser
module.exports.getStringifier = getStringifier

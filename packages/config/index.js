'use strict'

const { ConfigManager } = require('./lib/manager')
const { Store } = require('./lib/store')
const { loadConfig, printConfigValidationErrors, printAndExitLoadConfigError } = require('./lib/load-config')
const errors = require('./lib/errors')

module.exports = ConfigManager
module.exports.ConfigManager = ConfigManager
module.exports.Store = Store
module.exports.loadConfig = loadConfig
module.exports.printConfigValidationErrors = printConfigValidationErrors
module.exports.printAndExitLoadConfigError = printAndExitLoadConfigError
module.exports.errors = errors

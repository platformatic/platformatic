'use strict'

const { ConfigManager } = require('./lib/manager')
const { Store, matchKnownSchema } = require('./lib/store')
const { loadConfig, loadEmptyConfig } = require('./lib/load-config')
const errors = require('./lib/errors')

module.exports = ConfigManager
module.exports.ConfigManager = ConfigManager
module.exports.Store = Store
module.exports.matchKnownSchema = matchKnownSchema
module.exports.loadConfig = loadConfig
module.exports.loadEmptyConfig = loadEmptyConfig
module.exports.errors = errors

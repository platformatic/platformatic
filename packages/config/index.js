'ues strict'

const { ConfigManager } = require('./lib/manager')
const { Store } = require('./lib/store')
const loadConfig = require('./lib/load-config')

module.exports = ConfigManager
module.exports.ConfigManager = ConfigManager
module.exports.Store = Store
module.exports.loadConfig = loadConfig

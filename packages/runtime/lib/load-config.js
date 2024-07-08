'use strict'

const { Store, loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('./config')

function _loadConfig (minimistConfig, args, overrides, replaceEnv = true) {
  const store = new Store()
  store.add(platformaticRuntime)
  return loadConfig(minimistConfig, args, store, overrides, replaceEnv)
}

module.exports = { loadConfig: _loadConfig }

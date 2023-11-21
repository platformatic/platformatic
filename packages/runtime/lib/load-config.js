'use strict'

const { Store, loadConfig } = require('@platformatic/config')

const { platformaticService } = require('@platformatic/service')
const { platformaticDB } = require('@platformatic/db')
const { platformaticComposer } = require('@platformatic/composer')
const { platformaticRuntime } = require('./config')

const store = new Store()
store.add(platformaticService)
store.add(platformaticDB)
store.add(platformaticComposer)
store.add(platformaticRuntime)

function _loadConfig (minimistConfig, args, overrides, replaceEnv = true) {
  return loadConfig(minimistConfig, args, store, overrides, replaceEnv)
}

module.exports = { loadConfig: _loadConfig }

'use strict'
const ConfigManager = require('@platformatic/config')
const { platformaticRuntime } = require('./config')
const { startWithConfig } = require('./start')
const { buildServer: buildServerService } = require('@platformatic/service')
const { loadConfig } = require('./load-config')

async function buildServerRuntime (options = {}) {
  if (!options.configManager) {
    // Instantiate a new config manager from the current options.
    const cm = new ConfigManager({
      ...platformaticRuntime.configManagerConfig,
      source: options
    })
    await cm.parseAndValidate()

    if (typeof options === 'string') {
      options = { configManager: cm }
    } else {
      options.configManager = cm
    }
  }

  return startWithConfig(options.configManager)
}

async function buildServer (options) {
  if (typeof options === 'string') {
    const config = await loadConfig({}, ['-c', options])
    options = config.configManager.current
    options.configManager = config.configManager
    options.app = config.app
  }

  const app = options.app

  delete options.app

  if (app === platformaticRuntime || !app) {
    return buildServerRuntime(options)
  }

  return buildServerService(options, app)
}

module.exports = { buildServer }

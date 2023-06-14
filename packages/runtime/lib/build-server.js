'use strict'
const ConfigManager = require('@platformatic/config')
const { platformaticRuntime } = require('./config')
const { startWithConfig } = require('./start')

async function buildServer (options = {}) {
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

  // The transformConfig() function can't be sent between threads.
  delete options.configManager._transformConfig

  return startWithConfig(options.configManager)
}

module.exports = { buildServer }

'use strict'

const ConfigManager = require('@platformatic/config')
const { platformaticRuntime } = require('./config')
const { buildRuntime } = require('./start')
const { loadConfig } = require('./utils')

async function buildServerRuntime (options = {}, args = undefined) {
  const { serviceMap } = options

  if (!options.configManager) {
    delete options.serviceMap

    // Instantiate a new config manager from the current options.
    const cm = new ConfigManager({
      ...platformaticRuntime.configManagerConfig,
      source: options
    })
    await cm.parseAndValidate()

    cm.current.serviceMap = serviceMap

    if (typeof options === 'string') {
      options = { configManager: cm }
    } else {
      options.configManager = cm
    }
  }

  if (args) {
    options.configManager.args = args
  }

  return buildRuntime(options.configManager, options.env)
}

async function buildServer (options, args) {
  if (typeof options === 'string') {
    const config = await loadConfig({}, ['-c', options])
    options = config.configManager.current
    options.configManager = config.configManager
    options.app = config.app
  }

  const app = options.app
  delete options.app

  if (app === platformaticRuntime || !app) {
    return buildServerRuntime(options, args)
  }

  if (app.buildServer) {
    return app.buildServer(options)
  }

  return app.create(options.configManager.dirname, options.configManager.fullPath)
}

module.exports = { buildServer }

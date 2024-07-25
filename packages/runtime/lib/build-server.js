'use strict'

const { createRequire } = require('node:module')
const { join } = require('node:path')
const ConfigManager = require('@platformatic/config')
const { platformaticRuntime } = require('./config')
const { buildRuntime } = require('./start')
const { loadConfig } = require('./load-config')

async function buildServerRuntime (options = {}) {
  const {
    serviceMap,
    loggingPort,
    loggingMetadata,
  } = options

  if (!options.configManager) {
    delete options.serviceMap
    delete options.loggingPort
    delete options.loggingMetadata

    // Instantiate a new config manager from the current options.
    const cm = new ConfigManager({
      ...platformaticRuntime.configManagerConfig,
      source: options,
    })
    await cm.parseAndValidate()

    cm.current.loggingPort = loggingPort
    cm.current.loggingMetadata = loggingMetadata
    cm.current.serviceMap = serviceMap

    if (typeof options === 'string') {
      options = { configManager: cm }
    } else {
      options.configManager = cm
    }
  }

  return buildRuntime(options.configManager, options.env)
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

  if (app.buildServer) {
    return app.buildServer(options)
  }

  // App is a stackable. Hopefully we have `@platformatic/service` available.
  const projectRoot = join(options.configManager.dirname, 'package.json')
  const require = createRequire(projectRoot)
  const { buildServer } = require('@platformatic/service')

  return buildServer(options, app)
}

module.exports = { buildServer }

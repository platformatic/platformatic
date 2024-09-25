'use strict'

const pkg = require('../../package.json')

module.exports = {
  version: '1.99.0', // This is to account alpha versions as well
  up: function (config) {
    if (config.restartOnError === undefined) {
      config.restartOnError = true
    }

    if (config.hotReload) {
      config.watch = config.hotReload
      delete config.hotReload
    }

    delete config.allowCycles

    config.$schema = `https://schemas.platformatic.dev/@platformatic/runtime/${pkg.version}.json`

    if (config.server?.logger) {
      config.logger = config.server.logger
      delete config.server.logger
    }

    return config
  }
}

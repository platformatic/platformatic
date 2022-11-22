'use strict'

const ConfigManager = require('@platformatic/config')
const { dirname, resolve, relative } = require('path')
const { schema } = require('./schema')
const clone = require('rfdc')()

class ServiceConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema,
      schemaOptions: {
        useDefaults: true,
        coerceTypes: true,
        strict: false
      },
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', ...(opts.envWhitelist || [])]
    })
  }

  _transformConfig () {
    const fixPluginPath = (plugin) => {
      plugin.path = this._fixRelativePath(plugin.path)
    }

    // relative-to-absolute plugin path
    /* c8 ignore next 3 */
    if (Array.isArray(this.current.plugin)) {
      this.current.plugin.forEach(fixPluginPath)
    } else if (this.current.plugin) {
      fixPluginPath(this.current.plugin)
    }
  }

  _sanitizeConfig () {
    const sanitizedConfig = clone(this.current)
    const dirOfConfig = dirname(this.fullPath)

    const fixPluginPath = (plugin) => {
      plugin.path = relative(dirOfConfig, plugin.path)
    }

    // relative-to-absolute plugin path
    /* c8 ignore next 6 */
    if (Array.isArray(this.current.plugin)) {
      sanitizedConfig.plugin.forEach(fixPluginPath)
    } else if (this.current.plugin) {
      fixPluginPath(sanitizedConfig.plugin)
    }

    return sanitizedConfig
  }

  _fixRelativePath (path) {
    return resolve(dirname(this.fullPath), path)
  }
}

module.exports = ServiceConfigManager

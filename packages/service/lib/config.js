'use strict'

const ConfigManager = require('@platformatic/config')
const { dirname, resolve, relative } = require('path')
const { schema } = require('./schema')
const clone = require('rfdc')()

class ServiceConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema: opts.schema || schema,
      schemaOptions: {
        useDefaults: true,
        coerceTypes: true,
        allErrors: true,
        strict: false
      },
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', ...(opts.envWhitelist || [])]
    })
  }

  _transformConfig () {
    const fixPluginPath = (plugin) => {
      // for some reasons c8 does not detect these
      /* c8 ignore next 3 */
      if (typeof plugin === 'string') {
        plugin = { path: plugin }
      }
      plugin.path = this._fixRelativePath(plugin.path)
      return plugin
    }

    // relative-to-absolute plugin path
    /* c8 ignore next 3 */
    if (Array.isArray(this.current.plugin)) {
      this.current.plugin = this.current.plugin.map(fixPluginPath)
    } else if (this.current.plugin) {
      this.current.plugin = fixPluginPath(this.current.plugin)
    }
  }

  _sanitizeConfig () {
    const sanitizedConfig = clone(this.current)
    const dirOfConfig = dirname(this.fullPath)

    const fixPluginPath = (plugin) => {
      // for some reasons c8 does not detect these
      /* c8 ignore next 3 */
      if (typeof plugin === 'string') {
        plugin = { path: plugin }
      }
      plugin.path = relative(dirOfConfig, plugin.path)
      return plugin
    }

    // relative-to-absolute plugin path
    /* c8 ignore next 6 */
    if (Array.isArray(this.current.plugin)) {
      sanitizedConfig.plugin = sanitizedConfig.plugin.map(fixPluginPath)
    } else if (this.current.plugin) {
      sanitizedConfig.plugin = fixPluginPath(sanitizedConfig.plugin)
    }

    return sanitizedConfig
  }

  _fixRelativePath (path) {
    return resolve(dirname(this.fullPath), path)
  }
}

module.exports = ServiceConfigManager

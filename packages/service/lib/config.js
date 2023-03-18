'use strict'

const ConfigManager = require('@platformatic/config')
const { resolve } = require('path')
const { schema } = require('./schema')

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
    if (this.current.plugins?.paths) {
      this.current.plugins.paths = this.current.plugins.paths.map(fixPluginPath)
    }

    // relative-to-absolute plugin path
    if (this.current.clients) {
      this.current.clients = this.current.clients.map(fixPluginPath)
    }

    const fixKeyAndCertPath = (arg) => {
      if (Array.isArray(arg)) {
        return arg.map(fixKeyAndCertPath)
      }

      if (typeof arg === 'object') {
        arg.path = this._fixRelativePath(arg.path)
      }

      return arg
    }

    if (this.current.server?.https) {
      this.current.server.https.key = fixKeyAndCertPath(this.current.server.https.key)
      this.current.server.https.cert = fixKeyAndCertPath(this.current.server.https.cert)
    }
  }

  _fixRelativePath (path) {
    return resolve(this.dirname, path)
  }
}

module.exports = ServiceConfigManager

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
    /* c8 ignore next 3 */
    if (Array.isArray(this.current.plugin)) {
      this.current.plugin = this.current.plugin.map(fixPluginPath)
    } else if (this.current.plugin) {
      this.current.plugin = fixPluginPath(this.current.plugin)
    }

    // TODO: handle arrays
    if (this.current.plugin?.typescript) {
      const typescript = this.current.plugin.typescript
      typescript.outDir = this._fixRelativePath(typescript.outDir)
    }
  }

  _fixRelativePath (path) {
    return resolve(this.dirname, path)
  }
}

module.exports = ServiceConfigManager

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
        allErrors: true
      },
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', ...(opts.envWhitelist || [])]
    })
  }

  _transformConfig () {
    // relative-to-absolute plugin path
    /* c8 ignore next 3 */
    if (this.current.plugin) {
      this.current.plugin.path = this._fixRelativePath(this.current.plugin.path)
    }
  }

  _sanitizeConfig () {
    const sanitizedConfig = clone(this.current)
    const dirOfConfig = dirname(this.fullPath)

    // relative-to-absolute plugin path
    /* c8 ignore next 3 */
    if (this.current.plugin) {
      sanitizedConfig.plugin.path = relative(dirOfConfig, this.current.plugin.path)
    }

    return sanitizedConfig
  }

  _fixRelativePath (path) {
    return resolve(dirname(this.fullPath), path)
  }
}

module.exports = ServiceConfigManager

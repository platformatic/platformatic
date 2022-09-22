'use strict'

const ConfigManager = require('@platformatic/config')
const { dirname, resolve } = require('path')
const { schema } = require('./schema')
const { computeSQLiteIgnores } = require('./utils')

class DBConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema,
      schemaOptions: {
        useDefaults: true,
        coerceTypes: true,
        allErrors: true
      },
      envWhitelist: ['PORT', 'DATABASE_URL', ...(opts.envWhitelist || [])]
    })
  }

  _fixRelativePath (path) {
    return resolve(dirname(this.fullPath), path)
  }

  _transformConfig () {
    const dirOfConfig = dirname(this.fullPath)
    if (this.current.core && this.current.core.connectionString.indexOf('sqlite') === 0) {
      const originalSqlitePath = this.current.core.connectionString.replace('sqlite://', '')
      const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
      const ignores = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
      this.current.core.connectionString = 'sqlite://' + sqliteFullPath
      if (!this.watchIgnore.includes(ignores[0])) { // if restarted, this array may include already the file
        this.watchIgnore.push(...ignores)
      }
    }

    // Ignore the ESM jumpfile created by fastify-isolate
    this.watchIgnore.push('.esm*')

    // relative-to-absolute migrations path
    if (this.current.migrations) {
      this.current.migrations.dir = this._fixRelativePath(this.current.migrations.dir)
      this.current.migrations.table = this.current.migrations.table || 'versions'
    }

    // relative-to-absolute plugin path
    if (this.current.plugin) {
      this.current.plugin.path = this._fixRelativePath(this.current.plugin.path)
    }

    if (this.current.migrations && this.current.core) {
      // TODO remove the ignores
      /* c8 ignore next 4 */
      this.current.core.ignore = this.current.core.ignore || {}
      this.current.core.ignore = Object.assign({}, {
        [this.current.migrations.table || 'versions']: true
      }, this.current.core.ignore)
    }
  }
}

module.exports = DBConfigManager

'use strict'

const { ConfigManager } = require('@platformatic/service')
const { dirname, resolve, relative, isAbsolute } = require('path')
const { schema } = require('./schema')

class DBConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema,
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', 'DATABASE_URL', ...(opts.envWhitelist || [])]
    })
  }

  _fixRelativePath (path) {
    return resolve(dirname(this.fullPath), path)
  }

  _transformConfig () {
    super._transformConfig.call(this)
    const dirOfConfig = dirname(this.fullPath)
    if (this.current.core && this.current.core.connectionString.indexOf('sqlite') === 0) {
      const originalSqlitePath = this.current.core.connectionString.replace('sqlite://', '')
      const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
      this.current.core.connectionString = 'sqlite://' + sqliteFullPath
    }

    const arePostgresqlSchemaDefined = this.current.core?.connectionString.indexOf('postgres') === 0 && this.current.core?.schema?.length > 0

    const migrationsTableName = arePostgresqlSchemaDefined ? 'public.versions' : 'versions'

    // relative-to-absolute migrations path
    if (this.current.migrations) {
      this.current.migrations.dir = this._fixRelativePath(this.current.migrations.dir)
      this.current.migrations.table = this.current.migrations.table || migrationsTableName
    }

    if (this.current.migrations && this.current.core) {
      // TODO remove the ignores
      /* c8 ignore next 4 */
      this.current.core.ignore = this.current.core.ignore || {}
      this.current.core.ignore = Object.assign({}, {
        [this.current.migrations.table || migrationsTableName]: true
      }, this.current.core.ignore)
    }

    if (this.current.plugin?.typescript?.outDir) {
      this.current.plugin.typescript.outDir = this._fixRelativePath(this.current.plugin.typescript.outDir)
    }
  }

  _sanitizeConfig () {
    const sanitizedConfig = super._sanitizeConfig.call(this)

    const dirOfConfig = dirname(this.fullPath)
    if (this.current.core && this.current.core.connectionString.indexOf('sqlite') === 0) {
      const sqliteFullPath = this.current.core.connectionString.replace('sqlite://', '')
      if (isAbsolute(sqliteFullPath)) {
        const originalSqlitePath = relative(dirOfConfig, sqliteFullPath)
        sanitizedConfig.core.connectionString = 'sqlite://' + originalSqlitePath
      }
    }
    // absolute-to-relative migrations path
    if (this.current.migrations && isAbsolute(this.current.migrations.dir)) {
      sanitizedConfig.migrations.dir = relative(dirOfConfig, this.current.migrations.dir)
    }

    return sanitizedConfig
  }
}

module.exports = DBConfigManager

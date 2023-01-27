'use strict'

const { ConfigManager } = require('@platformatic/service')
const { resolve } = require('path')
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

  _transformConfig () {
    super._transformConfig.call(this)
    const dirOfConfig = this.dirname
    if (this.current.core && this.current.core.connectionString.indexOf('sqlite') === 0 && this.current.core.connectionString !== 'sqlite://:memory:') {
      const originalSqlitePath = this.current.core.connectionString.replace('sqlite://', '')
      const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
      this.current.core.connectionString = 'sqlite://' + sqliteFullPath
    }

    /* c8 ignore next 2 */
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
  }
}

module.exports = DBConfigManager

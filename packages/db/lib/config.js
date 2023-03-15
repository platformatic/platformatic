'use strict'

const { ConfigManager } = require('@platformatic/service')
const { resolve } = require('path')
const { schema } = require('./schema')
const { readFile } = require('fs/promises')

class DBConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema,
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', 'DATABASE_URL', ...(opts.envWhitelist || [])]
    })
  }

  async _transformConfig () {
    super._transformConfig.call(this)
    const dirOfConfig = this.dirname
    if (this.current.db && this.current.db.connectionString.indexOf('sqlite') === 0 && this.current.db.connectionString !== 'sqlite://:memory:') {
      const originalSqlitePath = this.current.db.connectionString.replace('sqlite://', '')
      const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
      this.current.db.connectionString = 'sqlite://' + sqliteFullPath
    }

    /* c8 ignore next 4 */
    if (this.current.db.graphql?.schemaPath) {
      this.current.db.graphql.schemaPath = this._fixRelativePath(this.current.db.graphql.schemaPath)
      this.current.db.graphql.schema = await readFile(this.current.db.graphql.schemaPath, 'utf8')
    }

    /* c8 ignore next 2 */
    const arePostgresqlSchemaDefined = this.current.db?.connectionString.indexOf('postgres') === 0 && this.current.db?.schema?.length > 0
    const migrationsTableName = arePostgresqlSchemaDefined ? 'public.versions' : 'versions'

    // relative-to-absolute migrations path
    if (this.current.migrations) {
      this.current.migrations.dir = this._fixRelativePath(this.current.migrations.dir)
      this.current.migrations.table = this.current.migrations.table || migrationsTableName
    }

    if (this.current.migrations && this.current.db) {
      // TODO remove the ignores
      /* c8 ignore next 4 */
      this.current.db.ignore = this.current.db.ignore || {}
      this.current.db.ignore = Object.assign({}, {
        [this.current.migrations.table || migrationsTableName]: true
      }, this.current.db.ignore)
    }

    if (this.current.types?.dir) {
      this.current.types.dir = this._fixRelativePath(this.current.types.dir)
    }
  }
}

module.exports = DBConfigManager

'use strict'
const { resolve } = require('path')
const { readFile } = require('fs/promises')

module.exports = async function adjustConfig (configManager) {
  const dirOfConfig = configManager.dirname
  if (configManager.current.db && configManager.current.db.connectionString.indexOf('sqlite') === 0 && configManager.current.db.connectionString !== 'sqlite://:memory:') {
    const originalSqlitePath = configManager.current.db.connectionString.replace('sqlite://', '')
    const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
    configManager.current.db.connectionString = 'sqlite://' + sqliteFullPath
  }

  /* c8 ignore next 3 */
  if (configManager.current.db.graphql?.schemaPath) {
    configManager.current.db.graphql.schema = await readFile(configManager.current.db.graphql.schemaPath, 'utf8')
  }

  /* c8 ignore next 2 */
  const arePostgresqlSchemaDefined = configManager.current.db?.connectionString.indexOf('postgres') === 0 && configManager.current.db?.schema?.length > 0
  const migrationsTableName = arePostgresqlSchemaDefined ? 'public.versions' : 'versions'

  // relative-to-absolute migrations path
  if (configManager.current.migrations) {
    configManager.current.migrations.table = configManager.current.migrations.table || migrationsTableName
  }

  if (configManager.current.migrations && configManager.current.db) {
    // TODO remove the ignores
    /* c8 ignore next 4 */
    configManager.current.db.ignore = configManager.current.db.ignore || {}
    configManager.current.db.ignore = Object.assign({}, {
      [configManager.current.migrations.table || migrationsTableName]: true
    }, configManager.current.db.ignore)
  }
}

import { transform as serviceTransform } from '@platformatic/service'
import { readFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { kMetadata } from '@platformatic/foundation'

export async function transform (config) {
  config = await serviceTransform(config)

  if (
    config.db &&
    config.db.connectionString.indexOf('sqlite') === 0 &&
    config.db.connectionString !== 'sqlite://:memory:'
  ) {
    const originalSqlitePath = config.db.connectionString.replace('sqlite://', '')
    const sqliteFullPath = resolvePath(config[kMetadata].root, originalSqlitePath)
    config.db.connectionString = 'sqlite://' + sqliteFullPath
  }

  /* c8 ignore next 3 */
  if (config.db.graphql?.schemaPath) {
    config.db.graphql.schema = await readFile(config.db.graphql.schemaPath, 'utf8')
  }

  /* c8 ignore next 2 */
  const arePostgresqlSchemaDefined =
    config.db?.connectionString.indexOf('postgres') === 0 && config.db?.schema?.length > 0
  const migrationsTableName = arePostgresqlSchemaDefined ? 'public.versions' : 'versions'

  // relative-to-absolute migrations path
  if (config.migrations) {
    config.migrations.table = config.migrations.table || migrationsTableName
  }

  if (config.migrations && config.db) {
    // TODO remove the ignores
    /* c8 ignore next 4 */
    config.db.ignore = config.db.ignore || {}
    config.db.ignore = Object.assign(
      {},
      {
        [config.migrations.table || migrationsTableName]: true
      },
      config.db.ignore
    )
  }

  if (config.types?.autogenerate === 'true') {
    config.types.autogenerate = true
  }

  return config
}

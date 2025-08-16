import { resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { transform as serviceTransform } from '@platformatic/service'
import { readFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { schema } from './lib/schema.js'
import { DatabaseStackable } from './lib/stackable.js'
import { upgrade } from './lib/upgrade.js'

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

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'db')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    replaceEnvIgnore: ['$.db.openapi.ignoreRoutes'],
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new DatabaseStackable(config[kMetadata].root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticDatabase } from './lib/application.js'
export * from './lib/commands/index.js'
export * from './lib/errors.js'
export * as errors from './lib/errors.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export { DatabaseStackable } from './lib/stackable.js'

'use strict'

const { resolveStackable } = require('@platformatic/basic')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const {
  configManagerConfig: serviceConfigManagerConfig,
  transformConfig: serviceTransformConfig,
  getTypescriptCompilationOptions
} = require('@platformatic/service')
const { platformaticDatabase } = require('./lib/application')
const { Generator } = require('./lib/generator')
const { DatabaseStackable } = require('./lib/stackable')
const { schema, packageJson } = require('./lib/schema')
const schemaComponents = require('./lib/schema')
const { ConfigManager } = require('@platformatic/config')
const errors = require('./lib/errors')
const { readFile } = require('node:fs/promises')
const { resolve } = require('node:path')

async function transformConfig () {
  await serviceTransformConfig.call(this)

  const dirOfConfig = this.dirname
  if (
    this.current.db &&
    this.current.db.connectionString.indexOf('sqlite') === 0 &&
    this.current.db.connectionString !== 'sqlite://:memory:'
  ) {
    const originalSqlitePath = this.current.db.connectionString.replace('sqlite://', '')
    const sqliteFullPath = resolve(dirOfConfig, originalSqlitePath)
    this.current.db.connectionString = 'sqlite://' + sqliteFullPath
  }

  /* c8 ignore next 3 */
  if (this.current.db.graphql?.schemaPath) {
    this.current.db.graphql.schema = await readFile(this.current.db.graphql.schemaPath, 'utf8')
  }

  /* c8 ignore next 2 */
  const arePostgresqlSchemaDefined =
    this.current.db?.connectionString.indexOf('postgres') === 0 && this.current.db?.schema?.length > 0
  const migrationsTableName = arePostgresqlSchemaDefined ? 'public.versions' : 'versions'

  // relative-to-absolute migrations path
  if (this.current.migrations) {
    this.current.migrations.table = this.current.migrations.table || migrationsTableName
  }

  if (this.current.migrations && this.current.db) {
    // TODO remove the ignores
    /* c8 ignore next 4 */
    this.current.db.ignore = this.current.db.ignore || {}
    this.current.db.ignore = Object.assign(
      {},
      {
        [this.current.migrations.table || migrationsTableName]: true
      },
      this.current.db.ignore
    )
  }

  if (this.current.types?.autogenerate === 'true') {
    this.current.types.autogenerate = true
  }
}

const configManagerConfig = {
  ...serviceConfigManagerConfig,
  transformConfig,
  replaceEnvIgnore: ['$.db.openapi.ignoreRoutes']
}

// This will be replaced by create before the release of v3
async function buildStackable (opts) {
  return create(opts.context.directory, opts.config, {}, opts.context)
}

async function create (fileOrDirectory, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(fileOrDirectory, sourceOrConfig, 'db')
  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  const configManager = new ConfigManager({ schema, source, ...configManagerConfig, dirname: root, context })
  await configManager.parseAndValidate()

  return new DatabaseStackable(opts, root, configManager)
}

module.exports = {
  Generator,
  DatabaseStackable,
  errors,
  createConnectionPool,
  platformaticDatabase,
  create,
  skipTelemetryHooks: true,
  // Old exports - These might be removed in a future PR
  transformConfig,
  configType: 'db',
  configManagerConfig,
  buildStackable,
  schema,
  schemaComponents,
  version: packageJson.version,
  getTypescriptCompilationOptions
}

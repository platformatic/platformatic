'use strict'

const { createConnectionPool } = require('@platformatic/sql-mapper')
const { createConfigManager, resolveStackable, sanitizeCreationArguments } = require('@platformatic/basic')
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
const errors = require('./lib/errors')
const { upgrade } = require('./lib/upgrade')
const { readFile } = require('node:fs/promises')
const { resolve } = require('node:path')
const { createMigrations, helpFooter: createMigrationsFooter } = require('./lib/commands/migrations-create')
const { applyMigrations, helpFooter: applyMigrationsFooter } = require('./lib/commands/migrations-apply')
const { seed, helpFooter: seedFooter } = require('./lib/commands/seed')
const { generateTypes, helpFooter: typesFooter } = require('./lib/commands/types')
const { printSchema } = require('./lib/commands/print-schema')

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

async function create (configFileOrRoot, sourceOrConfig, rawOpts, rawContext) {
  const { root, source } = await resolveStackable(configFileOrRoot, sourceOrConfig, 'db')
  const { opts, context } = await sanitizeCreationArguments(root, rawOpts, rawContext)

  const configManager = await createConfigManager(
    { schema, upgrade, config: configManagerConfig, version: packageJson.version },
    root,
    source,
    opts,
    context
  )

  return new DatabaseStackable(opts, root, configManager)
}

function createCommands (id) {
  return {
    commands: {
      [`${id}:migrations:create`]: createMigrations,
      [`${id}:migrations:apply`]: applyMigrations,
      [`${id}:seed`]: seed,
      [`${id}:types`]: generateTypes,
      [`${id}:schema`]: printSchema
    },
    help: {
      [`${id}:migrations:create`]: {
        usage: `${id}:migrations:create`,
        description: 'Create a new migration file',
        footer: createMigrationsFooter
      },
      [`${id}:migrations:apply`]: {
        usage: `${id}:migrations:apply`,
        description: 'Apply all configured migrations to the database',
        footer: applyMigrationsFooter,
        options: [
          {
            usage: '-r, --rollback',
            description: 'Rollback migrations instead of applying them'
          },
          {
            usage: '-t, --to <version>',
            description: 'Migrate to a specific version'
          }
        ]
      },
      [`${id}:seed`]: {
        usage: `${id}:seed [file]`,
        description: 'Load a seed into the database.',
        footer: seedFooter,
        args: [
          {
            name: 'file',
            description: 'The seed file to load.'
          }
        ]
      },
      [`${id}:types`]: {
        usage: `${id}:types`,
        description: 'Generate typescript types for your entities from the database.',
        footer: typesFooter
      },
      [`${id}:schema`]: {
        usage: `${id}:schema [openapi|graphql]`,
        description: 'Prints the OpenAPI or GraphQL schema for the database.'
      }
    }
  }
}

module.exports.Generator = Generator
module.exports.DatabaseStackable = DatabaseStackable
module.exports.errors = errors
module.exports.createConnectionPool = createConnectionPool
module.exports.platformaticDatabase = platformaticDatabase
module.exports.create = create
module.exports.createCommands = createCommands
module.exports.skipTelemetryHooks = true
// Old exports - These might be removed in a future PR
module.exports.transformConfig = transformConfig
module.exports.configType = 'db'
module.exports.configManagerConfig = configManagerConfig
module.exports.buildStackable = buildStackable
module.exports.schema = schema
module.exports.schemaComponents = schemaComponents
module.exports.version = packageJson.version
module.exports.getTypescriptCompilationOptions = getTypescriptCompilationOptions

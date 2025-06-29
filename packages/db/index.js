'use strict'

const { resolveStackable } = require('@platformatic/basic')
const core = require('@platformatic/db-core')
const auth = require('@platformatic/db-authorization')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const {
  platformaticService,
  registerCriticalPlugins,
  configManagerConfig: serviceConfigManagerConfig,
  ServiceStackable,
  transformConfig: serviceTransformConfig,
  getTypescriptCompilationOptions
} = require('@platformatic/service')
const { isKeyEnabled } = require('@platformatic/utils')
const { Generator } = require('./lib/generator')
const { schema, packageJson } = require('./lib/schema')
const schemaComponents = require('./lib/schema')
const { ConfigManager } = require('@platformatic/config')
const { locateSchemaLock, updateSchemaLock } = require('./lib/utils')
const errors = require('./lib/errors')
const { readFile, writeFile } = require('node:fs/promises')
const { resolve } = require('node:path')

async function healthCheck (app) {
  const { db, sql } = app.platformatic
  try {
    await db.query(sql`SELECT 1`)
    return true
  } catch (err) {
    app.log.warn({ err }, 'Healthcheck failed')
    return false
  }
}

async function platformaticDatabase (app, stackable) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  let createSchemaLock = false
  await loadSchemaLock()

  async function loadSchemaLock () {
    if (config.db.schemalock) {
      // ignore errors, this is an optimization
      try {
        const path = locateSchemaLock(configManager)
        const dbschema = JSON.parse(await readFile(path, 'utf8'))
        config.db.dbschema = dbschema
        app.log.trace({ dbschema }, 'loaded schema lock')
        createSchemaLock = false
      } catch (err) {
        app.log.trace({ err }, 'failed to load schema lock')
        app.log.info('no schema lock found, will create one')
        createSchemaLock = true
      }
    }
  }

  if (config.migrations && config.migrations.autoApply === true && !app.restarted) {
    app.log.debug({ migrations: config.migrations }, 'running migrations')
    const { execute } = await import('./lib/migrate.mjs')
    const migrationsApplied = await execute({ logger: app.log, config })
    if (migrationsApplied) {
      // reload schema lock
      await updateSchemaLock(app.log, configManager)
      await loadSchemaLock()
    }

    if (config.types && config.types.autogenerate === true) {
      app.log.debug({ types: config.types }, 'generating types')
      const { execute } = await import('./lib/gen-types.mjs')
      await execute({ logger: app.log, config, configManager })
    }
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    if (typeof config.server.healthCheck !== 'object') {
      config.server.healthCheck = {}
    }
    config.server.healthCheck.fn = healthCheck
  }

  if (createSchemaLock) {
    try {
      const path = locateSchemaLock(configManager)
      await writeFile(path, JSON.stringify(app.platformatic.dbschema, null, 2))
      app.log.info({ path }, 'created schema lock')
    } catch (err) {
      app.log.trace({ err }, 'unable to save schema lock')
    }
  }

  await registerCriticalPlugins(app, stackable)

  await app.register(core, config.db)

  if (config.authorization) {
    await app.register(auth, config.authorization)
  }

  await platformaticService(app, stackable)

  if (Object.keys(app.platformatic.entities).length === 0) {
    app.log.warn(
      'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? ' +
        'This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db'
    )
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    await app.register(require('./lib/root'), config)
  }
}

platformaticDatabase[Symbol.for('skip-override')] = true

class DatabaseStackable extends ServiceStackable {
  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'db'
    this.version = packageJson.version
    this.applicationFactory = this.context.applicationFactory ?? platformaticDatabase
  }

  updateContext (context) {
    super.updateContext(context)

    const config = this.configManager.current
    if (this.context.isProduction && config.autogenerate) {
      config.autogenerate = false
      this.configManager.update(config)
    }
  }

  async getMeta () {
    const serviceMeta = await super.getMeta()

    const config = this.configManager.current

    const dbConfig = config.db
    const connectionString = dbConfig?.connectionString

    if (connectionString) {
      return {
        ...serviceMeta,
        connectionStrings: [connectionString]
      }
    }

    return serviceMeta
  }
}

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

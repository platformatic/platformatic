'use strict'

const core = require('@platformatic/db-core')
const auth = require('@platformatic/db-authorization')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const { platformaticService, buildServer } = require('@platformatic/service')
const { isKeyEnabled } = require('@platformatic/utils')
const { schema } = require('./lib/schema')
const ConfigManager = require('@platformatic/config')
const adjustConfig = require('./lib/adjust-config')
const { locateSchemaLock, updateSchemaLock } = require('./lib/utils')
const errors = require('./lib/errors')
const upgrade = require('./lib/upgrade')
const fs = require('fs/promises')
const version = require('./package.json').version

async function platformaticDB (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  let createSchemaLock = false
  await loadSchemaLock()

  async function loadSchemaLock () {
    if (config.db.schemalock) {
      // ignore errors, this is an optimization
      try {
        const path = locateSchemaLock(configManager)
        const dbschema = JSON.parse(await fs.readFile(path, 'utf8'))
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
      await fs.writeFile(path, JSON.stringify(app.platformatic.dbschema, null, 2))
      app.log.info({ path }, 'created schema lock')
    } catch (err) {
      app.log.trace({ err }, 'unable to save schema lock')
    }
  }

  async function toLoad (app) {
    await app.register(core, config.db)

    if (config.authorization) {
      await app.register(auth, config.authorization)
    }

    if (Object.keys(app.platformatic.entities).length === 0) {
      app.log.warn(
        'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? ' +
        'This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db'
      )
    }
  }
  toLoad[Symbol.for('skip-override')] = true

  await app.register(platformaticService, {
    ...opts,
    beforePlugins: [toLoad]
  })

  if (!app.hasRoute({ url: '/', method: 'GET' })) {
    app.register(require('./lib/root-endpoint'), config)
  }
}

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

platformaticDB[Symbol.for('skip-override')] = true
platformaticDB.schema = schema
platformaticDB.configType = 'db'
platformaticDB.configManagerConfig = {
  version,
  schema,
  envWhitelist: ['DATABASE_URL', ...platformaticService.configManagerConfig.envWhitelist],
  allowToWatch: ['.env'],
  schemaOptions: platformaticService.configManagerConfig.schemaOptions,
  async transformConfig () {
    await adjustConfig(this)
  },
  upgrade
}

function _buildServer (options) {
  return buildServer(options, platformaticDB)
}

module.exports.buildServer = _buildServer
module.exports.schema = schema
module.exports.platformaticDB = platformaticDB
module.exports.ConfigManager = ConfigManager
module.exports.errors = errors
module.exports.createConnectionPool = createConnectionPool
module.exports.Generator = require('./lib/generator/db-generator').Generator

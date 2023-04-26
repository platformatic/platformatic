'use strict'

const core = require('@platformatic/db-core')
const auth = require('@platformatic/db-authorization')
const dashboard = require('@platformatic/db-dashboard')
const { platformaticService, buildServer } = require('@platformatic/service')
const { isKeyEnabled } = require('@platformatic/utils')
const { schema } = require('./lib/schema')
const ConfigManager = require('@platformatic/config')
const adjustConfig = require('./lib/adjust-config')

async function platformaticDB (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  await adjustConfig(configManager)

  if (config.migrations && config.migrations.autoApply === true && !app.restarted) {
    app.log.debug({ migrations: config.migrations }, 'running migrations')
    const { execute } = await import('./lib/migrate.mjs')
    await execute(app.log, { config: config.configFileLocation }, config)

    if (config.types && config.types.autogenerate === true) {
      app.log.debug({ types: config.types }, 'generating types')
      const { execute } = await import('./lib/gen-types.mjs')
      await execute(app.log, { config: config.configFileLocation }, config)
    }
  }

  if (isKeyEnabled('dashboard', config)) {
    app.register(require('./_admin'), { ...config, configManager, prefix: '_admin' })
    await app.register(dashboard, {
      path: config.dashboard.path
    })
  }

  async function toLoad (app) {
    app.register(core, config.db)
    if (config.authorization) {
      app.register(auth, config.authorization)
    }
  }
  toLoad[Symbol.for('skip-override')] = true

  if (isKeyEnabled('healthCheck', config.server)) {
    if (typeof config.server.healthCheck !== 'object') {
      config.server.healthCheck = {}
    }
    config.server.healthCheck.fn = healthCheck
  }

  await platformaticService(app, opts, [
    toLoad
  ])

  if (Object.keys(app.platformatic.entities).length === 0) {
    app.log.warn(
      'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? ' +
      'This guide can help with debugging Platformatic DB: https://oss.platformatic.dev/docs/guides/debug-platformatic-db'
    )
  }

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
platformaticDB.envWhitelist = ['DATABASE_URL', ...(platformaticService.envWhitelist)]

async function buildDBServer (options) {
  return buildServer(options, platformaticDB)
}

module.exports.buildServer = buildDBServer
module.exports.schema = schema
module.exports.platformaticDB = platformaticDB
module.exports.ConfigManager = ConfigManager

'use strict'

const core = require('@platformatic/db-core')
const auth = require('@platformatic/db-authorization')
const dashboard = require('@platformatic/db-dashboard')
const { platformaticService, buildServer } = require('@platformatic/service')
const { deepmerge, isKeyEnabled } = require('@platformatic/utils')
const { schema } = require('./lib/schema')
const ConfigManager = require('./lib/config.js')

async function platformaticDB (app, opts) {
  if (opts.migrations && opts.migrations.autoApply === true && !app.restarted) {
    app.log.debug({ migrations: opts.migrations }, 'running migrations')
    const { execute } = await import('./lib/migrate.mjs')
    await execute(app.log, { config: opts.configFileLocation }, opts)

    if (opts.types && opts.types.autogenerate === true) {
      app.log.debug({ types: opts.types }, 'generating types')
      const { execute } = await import('./lib/gen-types.mjs')
      await execute(app.log, { config: opts.configFileLocation }, opts)
    }
  }

  if (isKeyEnabled('dashboard', opts)) {
    app.register(require('./_admin'), { ...opts, prefix: '_admin' })
    await app.register(dashboard, {
      dashboardAtRoot: opts.dashboard.rootPath ?? true
    })
  }

  async function toLoad (app) {
    app.register(core, opts.core)
    if (opts.authorization) {
      app.register(auth, opts.authorization)
    }
  }
  toLoad[Symbol.for('skip-override')] = true

  if (isKeyEnabled('healthCheck', opts)) {
    if (typeof opts.healthCheck !== 'object') {
      opts.healthCheck = {}
    }
    opts.healthCheck.fn = async function (serverInstance) {
      const { db, sql } = serverInstance.platformatic
      try {
        await db.query(sql`SELECT 1`)
        return true
      } catch (err) {
        app.log.warn({ err }, 'Healthcheck failed')
        return false
      }
    }
  }

  await platformaticService(app, opts, [
    toLoad
  ])

  if (!app.hasRoute({ url: '/', method: 'GET' })) {
    app.register(require('./lib/root-endpoint'), opts)
  }
}

platformaticDB[Symbol.for('skip-override')] = true
platformaticDB.schema = schema

async function buildDBServer (options) {
  return buildServer(options, platformaticDB)
}

module.exports.buildServer = buildDBServer
module.exports.schema = schema
module.exports.platformaticDB = platformaticDB
module.exports.ConfigManager = ConfigManager

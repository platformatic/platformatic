'use strict'

const core = require('@platformatic/db-core')
const auth = require('@platformatic/db-authorization')
const dashboard = require('@platformatic/db-dashboard')
const { start } = require('@fastify/restartable')
const isolate = require('fastify-isolate')
const underPressure = require('@fastify/under-pressure')

const { isKeyEnabledInConfig } = require('./lib/helper')
const { schema } = require('./lib/schema')
const ConfigManager = require('./lib/config.js')
const { addLoggerToTheConfig } = require('./lib/utils')

function deepmergeArray (options) {
  const deepmerge = options.deepmerge
  const clone = options.clone
  return function (target, source) {
    let i = 0
    const sl = source.length
    const il = Math.max(target.length, source.length)
    const result = new Array(il)
    for (i = 0; i < il; ++i) {
      if (i < sl) {
        result[i] = deepmerge(target[i], source[i])
        /* c8 ignore next 3 */
      } else {
        result[i] = clone(target[i])
      }
    }
    return result
  }
}

const deepmerge = require('@fastify/deepmerge')({ all: true, mergeArray: deepmergeArray })

function createServerConfig (config) {
  // convert the config file to a new structure
  // to make @fastify/restartable happy
  const serverConfig = Object.assign({ ...config.server }, config)
  delete serverConfig.server
  return serverConfig
}

async function platformaticDB (app, opts) {
  if (opts.migrations && opts.migrations.autoApply !== false) {
    app.log.debug({ migrations: opts.migrations }, 'running migrations')
    const { execute } = await import('./lib/migrate.mjs')
    await execute(app.log, { config: opts.configFileLocation }, opts)
  }

  app.register(require('./_admin'), { ...opts, prefix: '_admin' })
  if (isKeyEnabledInConfig('dashboard', opts) && opts.dashboard.enabled) {
    await app.register(dashboard, {
      dashboardAtRoot: opts.dashboard.rootPath || true
    })
  }
  app.register(core, opts.core)

  if (opts.authorization) {
    app.register(auth, opts.authorization)
  }

  // Metrics plugin
  if (isKeyEnabledInConfig('metrics', opts)) {
    app.register(require('./lib/metrics-plugin'), opts.metrics)
  }

  if (opts.plugin) {
    app.log.debug({ plugin: opts.plugin }, 'loading plugin')
    await app.register(isolate, {
      ...opts.plugin,
      customizeGlobalThis (_globalThis) {
        // Taken from https://github.com/nodejs/undici/blob/fa9fd9066569b6357acacffb806aa804b688c9d8/lib/global.js#L5
        const globalDispatcher = Symbol.for('undici.globalDispatcher.1')
        const dispatcher = globalThis[globalDispatcher]
        if (dispatcher) {
          _globalThis[globalDispatcher] = dispatcher
        }
      }
    })
  }

  // Enable CORS
  if (opts.cors) {
    app.register(require('@fastify/cors'), opts.cors)
  }
  if (isKeyEnabledInConfig('healthCheck', opts)) {
    app.register(underPressure, {
      exposeStatusRoute: '/status',
      healthCheckInterval: opts.healthCheck.interval !== undefined ? opts.healthCheck.interval : 5000,
      healthCheck: async function (serverInstance) {
        const { db, sql } = serverInstance.platformatic
        try {
          await db.query(sql`SELECT 1`)
          return true
        } catch (err) {
          app.log.warn({ err }, 'Healthcheck failed')
          return false
        }
      }
    })
  }
  if (!app.hasRoute({ url: '/', method: 'GET' })) {
    app.register(require('./lib/root-endpoint'), opts)
  }
  await app
}

platformaticDB[Symbol.for('skip-override')] = true

async function buildServer (options) {
  if (!options.configManager) {
    // instantiate a new config manager from current options
    const cm = new ConfigManager({
      source: { ...options },
      schema
    })
    await cm.parseAndValidate()
    options = deepmerge({}, cm.current, options)
    options.configManager = cm
  }
  const serverConfig = createServerConfig(options)

  serverConfig.originalConfig = options
  serverConfig.app = platformaticDB
  const handler = await start(serverConfig)

  Object.defineProperty(handler, 'url', {
    get () {
      const address = handler.address
      const port = handler.port
      const url = `http://${address}:${port}`
      return url
    }
  })

  const _restart = handler.restart

  handler.restart = (opts) => {
    addLoggerToTheConfig(opts)

    // Ignore because not tested on Windows
    // TODO: remove the ignore, we shoduld be testing
    // this on Windows
    /* c8 ignore next 5 */
    if (opts) {
      opts = createServerConfig(opts)
      opts.app = platformaticDB
      return _restart(opts)
    }
    return _restart()
  }

  return handler
}

module.exports.buildServer = buildServer
module.exports.schema = schema
module.exports.createServerConfig = createServerConfig
module.exports.platformaticDB = platformaticDB

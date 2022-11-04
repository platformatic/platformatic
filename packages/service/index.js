'use strict'

const { start } = require('@fastify/restartable')
const sandbox = require('fastify-sandbox')
const underPressure = require('@fastify/under-pressure')
const { schema } = require('./lib/schema')
const ConfigManager = require('./lib/config.js')
const { addLoggerToTheConfig, getJSPluginPath } = require('./lib/utils')
const loadConfig = require('./lib/load-config')
const { isKeyEnabled, deepmerge } = require('@platformatic/utils')
const compiler = require('./lib/compile')

function createServerConfig (config) {
  // convert the config file to a new structure
  // to make @fastify/restartable happy
  const serverConfig = Object.assign({ ...config.server }, config)
  delete serverConfig.server
  return serverConfig
}

async function platformaticService (app, opts, toLoad = []) {
  if (isKeyEnabled('metrics', opts)) {
    app.register(require('./lib/metrics-plugin'), opts.metrics)
  }

  if (Array.isArray(toLoad)) {
    for (const plugin of toLoad) {
      await app.register(plugin, opts)
    }
  }

  if (!app.hasDecorator('platformatic')) {
    app.decorate('platformatic', {})
  }

  if (opts.plugin) {
    let pluginOptions = opts.plugin
    /* c8 ignore next 4 */
    if (pluginOptions.typescript !== undefined) {
      const pluginPath = getJSPluginPath(pluginOptions.path, pluginOptions.typescript.outDir)
      pluginOptions = { ...pluginOptions, path: pluginPath }
    }

    app.log.debug({ plugin: opts.plugin }, 'loading plugin')

    // if not defined, we defaults to true (which can happen only if config is set programmatically,
    // that's why we ignore the coverage of the `undefined` case, which cannot be covered in cli tests)
    /* c8 ignore next */
    const hotReload = opts.plugin.watchOptions?.hotReload !== false
    const isWatchEnabled = opts.plugin.watch !== false

    if (isWatchEnabled && hotReload) {
      await app.register(sandbox, {
        ...pluginOptions,
        customizeGlobalThis (_globalThis) {
        // Taken from https://github.com/nodejs/undici/blob/fa9fd9066569b6357acacffb806aa804b688c9d8/lib/global.js#L5
          const globalDispatcher = Symbol.for('undici.globalDispatcher.1')
          const dispatcher = globalThis[globalDispatcher]
          /* istanbul ignore else */
          if (dispatcher) {
            _globalThis[globalDispatcher] = dispatcher
          }
        }
      })
    // c8 fails in reporting the coverage of this else branch, so we ignore it
    /* c8 ignore next 7 */
    } else {
      let plugin = await import(`file://${pluginOptions.path}`)
      if (plugin.__esModule === true) {
        plugin = plugin.default
      }
      await app.register(plugin, pluginOptions.options)
    }
  }

  // Enable CORS
  if (opts.cors) {
    app.register(require('@fastify/cors'), opts.cors)
  }
  if (isKeyEnabled('healthCheck', opts)) {
    app.register(underPressure, {
      exposeStatusRoute: '/status',
      healthCheckInterval: opts.healthCheck.interval !== undefined ? opts.healthCheck.interval : 5000,
      healthCheck: opts.healthCheck.fn
    })
  }
}

platformaticService[Symbol.for('skip-override')] = true

async function buildServer (options, app = platformaticService) {
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
  serverConfig.app = app
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

  handler.restart = async (opts) => {
    addLoggerToTheConfig(opts)

    // Ignore because not tested on Windows
    // TODO: remove the ignore, we shoduld be testing
    // this on Windows
    /* c8 ignore start */
    if (opts) {
      opts = createServerConfig(opts)
      opts.app = app

      const fileWatcher = handler.app.platformatic.fileWatcher
      const configManager = handler.app.platformatic.configManager

      await _restart(opts)

      if (fileWatcher !== undefined) {
        handler.app.platformatic.fileWatcher = fileWatcher
      }
      if (configManager !== undefined) {
        handler.app.platformatic.configManager = configManager
        handler.app.platformatic.config = configManager.current
      }

      return handler
    }
    /* c8 ignore stop */
    return _restart()
  }

  return handler
}

module.exports.buildServer = buildServer
module.exports.schema = require('./lib/schema')
module.exports.createServerConfig = createServerConfig
module.exports.platformaticService = platformaticService
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.loadConfig = loadConfig
module.exports.tsCompiler = compiler

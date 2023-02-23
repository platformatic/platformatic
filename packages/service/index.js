'use strict'

const { start } = require('@fastify/restartable')
const autoload = require('@fastify/autoload')
const sandbox = require('fastify-sandbox')
const underPressure = require('@fastify/under-pressure')
const { schema } = require('./lib/schema')
const ConfigManager = require('./lib/config.js')
const { addLoggerToTheConfig, getJSPluginPath } = require('./lib/utils')
const loadConfig = require('./lib/load-config')
const { isKeyEnabled, deepmerge } = require('@platformatic/utils')
const compiler = require('./lib/compile')
const { stat } = require('fs').promises
const { join } = require('path')
const wrapperPath = join(__dirname, 'lib', 'autoload-wrapper.js')

function createServerConfig (config) {
  // convert the config file to a new structure
  // to make @fastify/restartable happy
  const serverConfig = Object.assign({ ...config.server }, config)
  delete serverConfig.server
  return serverConfig
}

function originToRegexp (origin) {
  if (typeof origin === 'object') {
    if (origin.regexp) {
      origin = new RegExp(origin.regexp)
    }
  }

  return origin
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

  {
    const fileWatcher = opts.fileWatcher
    const configManager = opts.configManager
    if (fileWatcher !== undefined) {
      app.platformatic.fileWatcher = fileWatcher
    }
    if (configManager !== undefined) {
      app.platformatic.configManager = configManager
      app.platformatic.config = configManager.current
    }
  }

  // TODO apparently c8 is not able to mark
  // this as covered even if it is
  /* c8 ignore next 7 */
  if (Array.isArray(opts.plugin)) {
    for (const plugin of opts.plugin) {
      await loadPlugin(app, opts, plugin)
    }
  } else if (opts.plugin) {
    await loadPlugin(app, opts, opts.plugin)
  }

  // Enable CORS
  if (opts.cors) {
    let origin = opts.cors.origin
    if (Array.isArray(origin)) {
      origin = origin.map(originToRegexp)
    } else {
      origin = originToRegexp(origin)
    }

    opts.cors.origin = origin

    app.register(require('@fastify/cors'), opts.cors)
  }
  if (isKeyEnabled('healthCheck', opts)) {
    app.register(underPressure, {
      exposeStatusRoute: '/status',
      healthCheckInterval: opts.healthCheck.interval !== undefined ? opts.healthCheck.interval : 5000,
      healthCheck: opts.healthCheck.fn,
      ...opts.healthCheck
    })
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !Array.isArray(toLoad)) {
    await app.register(require('./lib/root-endpoint'), opts)
  }
}

async function loadPlugin (app, config, pluginOptions) {
  /* c8 ignore next 4 */
  if (pluginOptions.typescript !== undefined) {
    const pluginPath = getJSPluginPath(pluginOptions.path, pluginOptions.typescript.outDir)
    pluginOptions = { ...pluginOptions, path: pluginPath }
  }

  app.log.debug({ plugin: pluginOptions }, 'loading plugin')

  // if not defined, we defaults to true (which can happen only if config is set programmatically,
  // that's why we ignore the coverage of the `undefined` case, which cannot be covered in cli tests)
  // all individual plugin hot reload settings will be overloaded by global hot reload
  /* c8 ignore next 35  */
  const hotReload = config.hotReload ?? pluginOptions.hotReload !== false
  const isWatchEnabled = config.watch !== false
  if (isWatchEnabled && hotReload) {
    let options = pluginOptions
    if ((await stat(pluginOptions.path)).isDirectory()) {
      options = {
        path: wrapperPath,
        options: pluginOptions
      }
    }
    await app.register(sandbox, {
      ...options,
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
  } else {
    if ((await stat(pluginOptions.path)).isDirectory()) {
      const options = {
        ...pluginOptions.options,
        dir: pluginOptions.path
      }
      await app.register(autoload, options)
    } else {
      let plugin = await import(`file://${pluginOptions.path}`)
      if (plugin.__esModule === true) {
        plugin = plugin.default
      }
      /* c8 ignore next 4 */
      await app.register(plugin, pluginOptions.options)
    }
  }
}

platformaticService[Symbol.for('skip-override')] = true
platformaticService.schema = schema

function adjustConfigBeforeMerge (cm) {
  // This function and adjustConfigAfterMerge() are needed because there are
  // edge cases that deepmerge() does not handle properly. This code does not
  // live in the generic config manager because that object is not aware of
  // these schema dependent details.
  const stash = new Map()

  // If a pino instance is passed as the logger, it will contain a child()
  // function that is not enumerable. Non-enumerables are not copied by
  // deepmerge(), so stash the logger here.
  /* c8 ignore next 5 */
  if (typeof cm.server?.logger?.child === 'function' &&
      !Object.prototype.propertyIsEnumerable.call(cm.server.logger, 'child')) {
    stash.set('server.logger', cm.server.logger)
    cm.server.logger = null
  }

  return stash
}

function adjustConfigAfterMerge (options, stash) {
  // Restore any config that needed to be stashed prior to merging.
  const pinoLogger = stash.get('server.logger')

  /* c8 ignore next 4 */
  if (pinoLogger) {
    options.server.logger = pinoLogger
    options.configManager.current.server.logger = pinoLogger
  }
}

async function buildServer (options, app, ConfigManagerContructor) {
  app = app || platformaticService
  ConfigManagerContructor = ConfigManagerContructor || ConfigManager

  if (!options.configManager) {
    // instantiate a new config manager from current options
    const cm = new ConfigManagerContructor({
      source: options,
      schema: app?.schema ?? schema
    })
    await cm.parseAndValidate()
    const stash = adjustConfigBeforeMerge(cm.current)
    options = deepmerge({}, options, cm.current)
    options.configManager = cm
    adjustConfigAfterMerge(options, stash)
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

  let debounce = null
  handler.restart = (opts) => {
    /* c8 ignore next 3 */
    if (debounce) {
      return debounce
    }

    addLoggerToTheConfig(opts)
    const configManager = handler.app.platformatic.configManager

    if (!opts) {
      opts = configManager.current
    }

    // Ignore because not tested on Windows
    // TODO: remove the ignore, we shoduld be testing
    // this on Windows
    const fileWatcher = handler.app.platformatic.fileWatcher
    opts.fileWatcher = fileWatcher
    opts.configManager = configManager
    opts = createServerConfig(opts)
    opts.app = app

    debounce = _restart(opts).then(() => {
      handler.app.log.info('restarted')
    }).finally(() => {
      debounce = null
    })
    return debounce
  }

  handler.app.restart = handler.restart

  return handler
}

module.exports.buildServer = buildServer
module.exports.schema = require('./lib/schema')
module.exports.createServerConfig = createServerConfig
module.exports.platformaticService = platformaticService
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.loadConfig = loadConfig
module.exports.tsCompiler = compiler
module.exports.ConfigManager = ConfigManager

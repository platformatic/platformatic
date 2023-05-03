'use strict'

const { start } = require('@fastify/restartable')
const sandbox = require('fastify-sandbox')
const underPressure = require('@fastify/under-pressure')
const { schema } = require('./lib/schema')
const ConfigManager = require('@platformatic/config')
const { loadConfig, generateDefaultConfig } = require('./lib/load-config')
const { addLoggerToTheConfig, getJSPluginPath, isFileAccessible } = require('./lib/utils')
const { isKeyEnabled } = require('@platformatic/utils')
const compiler = require('./lib/compile')
const { join, dirname, resolve } = require('path')
const { readFile } = require('fs/promises')
const wrapperPath = join(__dirname, 'lib', 'sandbox-wrapper.js')
const setupOpenAPI = require('./lib/openapi.js')
const setupGraphQL = require('./lib/graphql.js')

function originToRegexp (origin) {
  if (typeof origin === 'object') {
    if (origin.regexp) {
      origin = new RegExp(origin.regexp)
    }
  }

  return origin
}

async function platformaticService (app, opts, toLoad = []) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  if (isKeyEnabled('metrics', config)) {
    app.register(require('./lib/metrics-plugin'), config.metrics)
  }

  if (Array.isArray(toLoad)) {
    for (const plugin of toLoad) {
      await app.register(plugin)
    }
  }

  const serviceConfig = app.platformatic.config?.service

  if (serviceConfig?.openapi) {
    await setupOpenAPI(app, serviceConfig.openapi)
  }

  if (serviceConfig?.graphql) {
    await setupGraphQL(app, serviceConfig.graphql)
  }

  for (const plugin of (config.clients || [])) {
    app.register(require(plugin.path), {
      url: plugin.url
    })
  }

  if (config.plugins) {
    // if we don't have a fullPath, let's assume we are in a test and we can use the current working directory
    const configPath = configManager.fullPath || join(process.cwd(), 'platformatic.db.json')
    const tsConfigPath = join(dirname(configPath), 'tsconfig.json')
    /* c8 ignore next 21 */
    if (await isFileAccessible(tsConfigPath)) {
      const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
      const outDir = resolve(dirname(tsConfigPath), tsConfig.compilerOptions.outDir)
      config.plugins.paths = config.plugins.paths.map((plugin) => {
        if (typeof plugin === 'string') {
          return getJSPluginPath(configPath, plugin, outDir)
        } else {
          return {
            path: getJSPluginPath(configPath, plugin.path, outDir),
            options: plugin.options
          }
        }
      })
    } else {
      for (const plugin of config.plugins.paths) {
        const path = typeof plugin === 'string' ? plugin : plugin.path
        if (path.endsWith('.ts')) {
          throw new Error(`Cannot load plugin ${path}, tsconfig.json not found`)
        }
      }
    }

    // if not defined, we default to true (which can happen only if config is set programmatically,
    // that's why we ignore the coverage of the `undefined` case, which cannot be covered in cli tests)
    // all individual plugin hot reload settings will be overloaded by global hot reload
    /* c8 ignore next 1 */
    const hotReload = config.plugins.hotReload !== false
    const isWatchEnabled = config.watch !== false

    app.log.debug({ plugins: config.plugins.paths, hotReload, isWatchEnabled }, 'loading plugins')

    if (isWatchEnabled && hotReload) {
      await app.register(sandbox, {
        path: wrapperPath,
        options: { paths: config.plugins.paths },
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
    } else {
      await app.register(require(wrapperPath), { paths: config.plugins.paths })
    }
  }

  // Enable CORS
  if (config.server.cors) {
    let origin = config.server.cors.origin
    if (Array.isArray(origin)) {
      origin = origin.map(originToRegexp)
    } else {
      origin = originToRegexp(origin)
    }

    config.server.cors.origin = origin

    app.register(require('@fastify/cors'), config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    const healthCheck = config.server.healthCheck
    app.register(underPressure, {
      exposeStatusRoute: '/status',
      healthCheckInterval: healthCheck.interval !== undefined ? healthCheck.interval : 5000,
      ...healthCheck,
      healthCheck: healthCheck.fn
    })
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !Array.isArray(toLoad)) {
    await app.register(require('./lib/root-endpoint'))
  }
}

platformaticService[Symbol.for('skip-override')] = true
platformaticService.schema = schema
platformaticService.envWhitelist = ['PORT', 'HOSTNAME']

async function adjustHttpsKeyAndCert (arg) {
  if (typeof arg === 'string') {
    return arg
  }

  if (!Array.isArray(arg)) {
    // { path: pathToKeyOrCert }
    return readFile(arg.path)
  }

  // Array of strings or objects.
  for (let i = 0; i < arg.length; ++i) {
    arg[i] = await adjustHttpsKeyAndCert(arg[i])
  }

  return arg
}

function defaultConfig (app, source) {
  const res = {
    source,
    ...generateDefaultConfig(),
    allowToWatch: ['.env', ...(app?.allowToWatch || [])],
    envWhitelist: ['PORT', ...(app?.envWhitelist || [])]
  }

  if (app.schema) {
    res.schema = app.schema
  }

  return res
}

async function buildServer (options, app) {
  app = app || platformaticService
  let cm

  if (!options.configManager) {
    // instantiate a new config manager from current options
    cm = new ConfigManager(defaultConfig(app, options))
    await cm.parseAndValidate()
  } else {
    cm = options.configManager
  }

  // options is a path
  if (typeof options === 'string') {
    options = cm.current
  }

  async function jumpApp (root) {
    root.decorate('platformatic', {})

    const fileWatcher = options.fileWatcher
    /* c8 ignore next 3 */
    if (fileWatcher !== undefined) {
      root.platformatic.fileWatcher = fileWatcher
    }
    root.platformatic.configManager = cm
    root.platformatic.config = cm.current
    root.register(app)
  }
  jumpApp[Symbol.for('skip-override')] = true

  const serverConfig = {
    ...(options.server),
    configManager: cm,
    app: jumpApp
  }

  if (serverConfig.https) {
    serverConfig.key = await adjustHttpsKeyAndCert(options.server.https.key)
    serverConfig.cert = await adjustHttpsKeyAndCert(options.server.https.cert)
    delete serverConfig.https
    serverConfig.protocol = 'https'
  } else if (options.server) {
    serverConfig.protocol = 'http'
  }

  const handler = await start(serverConfig)

  Object.defineProperty(handler, 'url', {
    get () {
      const protocol = serverConfig.protocol
      const address = handler.address
      const port = handler.port
      const url = `${protocol}://${address}:${port}`
      return url
    }
  })

  restarter(handler, cm, jumpApp)

  return handler
}

function restarter (handler, cm, jumpApp) {
  let debounce = null
  const _restart = handler.restart
  handler.restart = restart
  handler.app.restart = restart

  // This is covered by tests but c8 doesn't see it
  /* c8 ignore next 30 */
  async function restart (opts) {
    if (debounce) {
      return debounce
    }

    if (opts && !await cm.update(opts)) {
      const err = new Error('Invalid config')
      err.validationErrors = cm.validationErrors
      throw err
    }

    const restartOpts = {
      ...(cm.current.server),
      fileWatcher: handler.app.platformatic.fileWatcher,
      configManager: cm,
      app: jumpApp
    }

    debounce = _restart(restartOpts).then(() => {
      handler.app.log.info('restarted')
    }).finally(() => {
      debounce = null
    })
    return debounce
  }
}

// This is for @platformatic/db to use
/* c8 ignore next 4 */
async function buildStart (loadConfig, buildServer, configManagerConfig) {
  const { buildStart } = await import('./lib/start.mjs')
  return buildStart(loadConfig, buildServer, configManagerConfig)
}

module.exports.buildServer = buildServer
module.exports.schema = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.loadConfig = loadConfig
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.generateConfigManagerConfig = generateDefaultConfig
module.exports.tsCompiler = compiler
module.exports.buildStart = buildStart

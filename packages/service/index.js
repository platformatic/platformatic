'use strict'

const { start } = require('@fastify/restartable')
const sandbox = require('fastify-sandbox')
const underPressure = require('@fastify/under-pressure')
const { schema } = require('./lib/schema')
const ConfigManager = require('./lib/config.js')
const { addLoggerToTheConfig, getJSPluginPath, isFileAccessible } = require('./lib/utils')
const loadConfig = require('./lib/load-config')
const { isKeyEnabled, deepmerge } = require('@platformatic/utils')
const compiler = require('./lib/compile')
const { join, dirname, resolve } = require('path')
const { readFile } = require('fs/promises')
const wrapperPath = join(__dirname, 'lib', 'sandbox-wrapper.js')
const setupOpenAPI = require('./lib/openapi.js')
const setupGraphQL = require('./lib/graphql.js')

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
    /* c8 ignore next 3 */
    if (fileWatcher !== undefined) {
      app.platformatic.fileWatcher = fileWatcher
    }
    if (configManager !== undefined) {
      app.platformatic.configManager = configManager
      app.platformatic.config = configManager.current
    }
  }

  {
    const serviceConfig = app.platformatic.config?.service

    // for some unknown reason, c8 is not detecting any of this
    // despite being covered by test/routes.test.js
    /* c8 ignore next 3 */
    if (serviceConfig?.openapi) {
      await setupOpenAPI(app, app.platformatic.config?.service?.openapi)
    }

    /* c8 ignore next 3 */
    if (serviceConfig?.graphql) {
      await setupGraphQL(app, app.platformatic.config?.service?.graphql)
    }
  }

  if (opts.plugins) {
    // if we don't have a fullPath, let's assume we are in a test and we can use the current working directory
    const configPath = app.platformatic.configManager.fullPath || join(process.cwd(), 'platformatic.db.json')
    const tsConfigPath = join(dirname(configPath), 'tsconfig.json')
    /* c8 ignore next 21 */
    if (await isFileAccessible(tsConfigPath)) {
      const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
      const outDir = resolve(dirname(tsConfigPath), tsConfig.compilerOptions.outDir)
      opts.plugins.paths = opts.plugins.paths.map((plugin) => {
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
      for (const plugin of opts.plugins.paths) {
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
    const hotReload = opts.plugins.hotReload !== false
    const isWatchEnabled = app.platformatic.config.watch !== false
    app.log.debug({ plugins: opts.plugins.path }, 'loading plugin')

    if (isWatchEnabled && hotReload) {
      await app.register(sandbox, {
        path: wrapperPath,
        options: { paths: opts.plugins.paths },
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
      await app.register(require(wrapperPath), { paths: opts.plugins.paths })
    }
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
      ...opts.healthCheck,
      healthCheck: opts.healthCheck.fn
    })
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !Array.isArray(toLoad)) {
    await app.register(require('./lib/root-endpoint'), opts)
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

    if (options.server.https) {
      options.server.https.key = await adjustHttpsKeyAndCert(options.server.https.key)
      options.server.https.cert = await adjustHttpsKeyAndCert(options.server.https.cert)
      options.server = { ...options.server, ...options.server.https }
      delete options.server.https
      options.server.protocol = 'https'
    } else {
      options.server.protocol = 'http'
    }
  }
  const serverConfig = createServerConfig(options)

  serverConfig.originalConfig = options
  serverConfig.app = app
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

// This is for @platformatic/db to use
/* c8 ignore next 4 */
async function buildStart (loadConfig, buildServer) {
  const { buildStart } = await import('./lib/start.mjs')
  return buildStart(loadConfig, buildServer)
}

module.exports.buildServer = buildServer
module.exports.schema = require('./lib/schema')
module.exports.createServerConfig = createServerConfig
module.exports.platformaticService = platformaticService
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.loadConfig = loadConfig
module.exports.tsCompiler = compiler
module.exports.ConfigManager = ConfigManager
module.exports.buildStart = buildStart

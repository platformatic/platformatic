'use strict'

const { isKeyEnabled } = require('@platformatic/utils')
const { loadConfig, ConfigManager } = require('@platformatic/config')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const { workerData } = require('node:worker_threads')
const jsonPatch = require('fast-json-patch')

const setupCors = require('./lib/plugins/cors')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupClients = require('./lib/plugins/clients')
const setupMetrics = require('./lib/plugins/metrics')
const setupTsCompiler = require('./lib/plugins/typescript')
const setupHealthCheck = require('./lib/plugins/health-check')
const loadPlugins = require('./lib/plugins/plugins')
const upgrade = require('./lib/upgrade')
const { telemetry } = require('@platformatic/telemetry')

const { buildCompileCmd, extractTypeScriptCompileOptionsFromConfig } = require('./lib/compile')
const { schema } = require('./lib/schema')
const { addLoggerToTheConfig } = require('./lib/utils')
const { start, buildServer } = require('./lib/start')
const ServiceGenerator = require('./lib/generator/service-generator.js')
const { ServiceStackable } = require('./lib/stackable')

const { version } = require('./package.json')

// TODO(mcollina): arugments[2] is deprecated, remove it in the next major version.
async function platformaticService (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const beforePlugins = opts.beforePlugins || arguments[2] || []

  if (isKeyEnabled('metrics', config)) {
    if (config.metrics.server === 'own' && parseInt(config.server.port) === parseInt(config.metrics.port)) {
      app.log.warn('In order to serve metrics on the same port as the core applicaton, set metrics.server to "parent".')
      config.metrics.server = 'parent'
    }

    app.register(setupMetrics, config.metrics)
  }

  // This must be done before loading the plugins, so they can inspect if the
  // openTelemetry decorator exists and then configure accordingly.
  if (isKeyEnabled('telemetry', config)) {
    await app.register(telemetry, config.telemetry)
  }

  // This must be done before loading the plugins, so they can be
  // configured accordingly
  if (isKeyEnabled('clients', config)) {
    app.register(setupClients, config.clients)
  }

  if (Array.isArray(beforePlugins)) {
    for (const plugin of beforePlugins) {
      app.register(plugin)
    }
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    const openapi = serviceConfig.openapi
    app.register(setupOpenAPI, { openapi })
  }

  if (isKeyEnabled('graphql', serviceConfig)) {
    app.register(setupGraphQL, serviceConfig.graphql)
  }

  if (config.plugins) {
    let registerTsCompiler = false
    const typescript = config.plugins.paths && config.plugins.typescript
    /* c8 ignore next 6 */
    if (typescript === true) {
      registerTsCompiler = true
    } else if (typeof typescript === 'object') {
      registerTsCompiler = typescript.enabled === true || typescript.enabled === undefined
    }

    if (registerTsCompiler) {
      app.register(setupTsCompiler, { context: opts.context })
    }
    app.register(loadPlugins, { context: opts.context })
  }

  if (isKeyEnabled('cors', config.server)) {
    app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    app.register(setupHealthCheck, config.server.healthCheck)
  }
}

platformaticService[Symbol.for('skip-override')] = true

module.exports.configManagerConfig = {
  version,
  schema,
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  async transformConfig () {
    // Set watch to true by default. This is not possible
    // to do in the schema, because it is uses an anyOf.
    if (this.current.watch === undefined) {
      this.current.watch = { enabled: false }
    }

    if (typeof this.current.watch !== 'object') {
      this.current.watch = { enabled: this.current.watch || false }
    }

    const typescript = this.current.plugins?.typescript
    if (typescript) {
      let outDir = typescript.outDir
      if (outDir === undefined) {
        let tsConfigFile = typescript.tsConfigFile || 'tsconfig.json'
        tsConfigFile = join(this.dirname, tsConfigFile)
        try {
          const tsConfig = JSON.parse(await readFile(tsConfigFile, 'utf8'))
          outDir = tsConfig.compilerOptions.outDir
        } catch {}
        outDir ||= 'dist'
      }

      this.current.watch.ignore ||= []
      this.current.watch.ignore.push(outDir + '/**/*')
    }
  },
  upgrade
}

platformaticService.configType = 'service'
platformaticService.schema = schema
platformaticService.configManagerConfig = module.exports.configManagerConfig

function _buildServer (options, app, context) {
  return buildServer(options, app || module.exports, context)
}

// No-op for now, inserted for future compatibility
async function createDefaultConfig (opts) {
  return {}
}

async function buildStackable (options, app = platformaticService, Stackable = ServiceStackable) {
  let configManager = options.configManager

  if (configManager === undefined) {
    if (typeof options.config === 'string') {
      ;({ configManager } = await loadConfig(
        {},
        ['-c', options.config],
        app,
        {
          onMissingEnv: options.onMissingEnv,
          context: options.context
        },
        true
      ))
    } else {
      configManager = new ConfigManager({
        ...app.configManagerConfig,
        source: options.config,
        dirname: options.context?.directory
      })
      await configManager.parseAndValidate()
    }
  }

  const patch = workerData?.serviceConfig?.configPatch

  if (Array.isArray(patch)) {
    configManager.current = jsonPatch.applyPatch(configManager.current, patch).newDocument
  }

  const stackable = new Stackable({
    init: () =>
      buildServer(
        {
          configManager,
          ...configManager.current
        },
        app,
        options.context
      ),
    stackable: app,
    configManager,
    context: options.context
  })

  return stackable
}

module.exports.configType = 'service'
module.exports.isPLTService = true
module.exports.app = platformaticService
module.exports.schema = schema
module.exports.buildServer = _buildServer
module.exports.buildStackable = buildStackable
module.exports.createDefaultConfig = createDefaultConfig
module.exports.schemas = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.start = start
module.exports.Generator = ServiceGenerator
module.exports.ServiceStackable = ServiceStackable
module.exports.buildCompileCmd = buildCompileCmd
module.exports.extractTypeScriptCompileOptionsFromConfig = extractTypeScriptCompileOptionsFromConfig

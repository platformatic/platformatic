'use strict'

const { isKeyEnabled } = require('@platformatic/utils')
const { readFile } = require('fs/promises')
const { dirname, join } = require('path')

const compiler = require('./lib/compile')
const setupCors = require('./lib/plugins/cors')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupClients = require('./lib/plugins/clients')
const setupMetrics = require('./lib/plugins/metrics')
const setupTsCompiler = require('./lib/plugins/typescript')
const setupHealthCheck = require('./lib/plugins/health-check')
const loadPlugins = require('./lib/plugins/plugins')
const { telemetry } = require('@platformatic/telemetry')

const { schema } = require('./lib/schema')
const { loadConfig } = require('./lib/load-config')
const { addLoggerToTheConfig } = require('./lib/utils')
const { start, buildServer } = require('./lib/start')

async function platformaticService (app, opts, toLoad = []) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  if (isKeyEnabled('metrics', config)) {
    app.register(setupMetrics, config.metrics)
  }

  if (Array.isArray(toLoad)) {
    for (const plugin of toLoad) {
      await app.register(plugin)
    }
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    await app.register(setupOpenAPI, serviceConfig.openapi)
  }

  if (isKeyEnabled('graphql', serviceConfig)) {
    await app.register(setupGraphQL, serviceConfig.graphql)
  }

  if (config.telemetry) {
    app.register(telemetry, config.telemetry)
  }

  if (isKeyEnabled('clients', config)) {
    app.register(setupClients, config.clients)
  }

  if (config.plugins) {
    let registerTsCompiler = false
    const typescript = config.plugins.typescript
    if (typescript === true) {
      registerTsCompiler = true
    } else if (typeof typescript === 'object') {
      registerTsCompiler = typescript.enabled === true || typescript.enabled === undefined
    }

    if (registerTsCompiler) {
      await app.register(setupTsCompiler)
    }
    await app.register(loadPlugins)
  }

  if (config.server.cors) {
    app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    app.register(setupHealthCheck, config.server.healthCheck)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !Array.isArray(toLoad)) {
    await app.register(require('./lib/root-endpoint'))
  }
}

platformaticService[Symbol.for('skip-override')] = true
platformaticService.schema = schema
platformaticService.configType = 'service'
platformaticService.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
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
        tsConfigFile = join(dirname(this.fullPath), tsConfigFile)
        try {
          const tsConfig = JSON.parse(await readFile(tsConfigFile, 'utf8'))
          outDir = tsConfig.compilerOptions.outDir
        } catch {}
        outDir ||= 'dist'
      }

      this.current.watch.ignore ||= []
      this.current.watch.ignore.push(outDir + '/**/*')
    }
  }
}

function _buildServer (options, app) {
  return buildServer(options, app || platformaticService)
}

module.exports.buildServer = _buildServer
module.exports.schema = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.loadConfig = loadConfig
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.tsCompiler = compiler
module.exports.start = start

'use strict'

const { isKeyEnabled } = require('@platformatic/utils')
const { readFile } = require('fs/promises')
const { join } = require('path')

const compiler = require('./lib/compile')
const setupCors = require('./lib/plugins/cors')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupClients = require('./lib/plugins/clients')
const setupMetrics = require('./lib/plugins/metrics')
const setupTsCompiler = require('./lib/plugins/typescript')
const setupHealthCheck = require('./lib/plugins/health-check')
const loadPlugins = require('./lib/plugins/plugins')
const loadVersions = require('./lib/plugins/versions')
const { telemetry } = require('@platformatic/telemetry')

const { schema } = require('./lib/schema')
const { addLoggerToTheConfig } = require('./lib/utils')
const { start, buildServer } = require('./lib/start')
const ServiceGenerator = require('./lib/generator/service-generator.js')

// TODO(mcollina): toLoad is deprecated, remove it in the next major version.
async function platformaticService (app, opts, toLoad) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const beforePlugins = opts.beforePlugins || toLoad || []

  if (isKeyEnabled('metrics', config)) {
    app.register(setupMetrics, config.metrics)
  }

  // This must be done before loading the plugins, so they can inspect if the
  // openTelemetry decoretor exists and then configure accordingly.
  if (isKeyEnabled('telemetry', config)) {
    await app.register(telemetry, config.telemetry)
  }

  if (Array.isArray(beforePlugins)) {
    for (const plugin of beforePlugins) {
      app.register(plugin)
    }
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    const openapi = serviceConfig.openapi
    const versions = config.versions
    app.register(setupOpenAPI, { openapi, versions })
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
      app.register(setupTsCompiler)
    }
    app.register(loadPlugins)
  }

  await app.register(async (app) => {
    if (config.versions) {
      // TODO: Add typescript mappers support
      await app.register(loadVersions)
    }
  })

  if (isKeyEnabled('clients', config)) {
    app.register(setupClients, config.clients)
  }

  if (isKeyEnabled('cors', config.server)) {
    app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    app.register(setupHealthCheck, config.server.healthCheck)
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
  }
}

function _buildServer (options, app) {
  return buildServer(options, app || platformaticService)
}

module.exports.buildServer = _buildServer
module.exports.schema = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.tsCompiler = compiler
module.exports.start = start
module.exports.Generator = ServiceGenerator

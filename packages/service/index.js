'use strict'

const { schemaOptions, transformConfig: basicTransformConfig, resolveStackable } = require('@platformatic/basic')
const { ConfigManager } = require('@platformatic/config')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const { platformaticService } = require('./lib/application.js')
const { Generator } = require('./lib/generator.js')
const { ServiceStackable } = require('./lib/stackable.js')
const { schema, packageJson } = require('./lib/schema.js')
const schemaComponents = require('./lib/schema.js')
const { isDocker } = require('./lib/utils.js')
const { getTypescriptCompilationOptions } = require('./lib/compile.js')

async function transformConfig () {
  await basicTransformConfig.call(this)

  if (this.current.server && (await isDocker())) {
    this.current.server.hostname = '0.0.0.0'
  }

  const typescript = this.current.plugins?.typescript

  if (typescript) {
    let { outDir, tsConfigFile } = typescript
    tsConfigFile ??= 'tsconfig.json'

    if (typeof outDir === 'undefined') {
      try {
        outDir = JSON.parse(await readFile(join(this.dirname, tsConfigFile), 'utf8')).compilerOptions.outDir
      } catch {
        // No-op
      }

      outDir ||= 'dist'
    }

    this.current.watch.ignore ??= []
    this.current.watch.ignore.push(outDir + '/**/*')
  }
}

const configManagerConfig = { schemaOptions, transformConfig }

// This will be replaced by create before the release of v3
async function buildStackable (opts) {
  return create(opts.context.directory, opts.config, {}, opts.context)
}

async function create (fileOrDirectory, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(fileOrDirectory, sourceOrConfig, 'service')

  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  const configManager = new ConfigManager({
    schema: opts.context.schema ?? schema,
    source,
    ...configManagerConfig,
    dirname: root,
    context
  })
  await configManager.parseAndValidate()

  return new ServiceStackable(opts, root, configManager)
}

module.exports.Generator = Generator
module.exports.ServiceStackable = ServiceStackable
module.exports.platformaticService = platformaticService
module.exports.create = create
module.exports.skipTelemetryHooks = true
// Old exports - These might be removed in a future PR
module.exports.transformConfig = transformConfig
module.exports.configType = 'service'
module.exports.configManagerConfig = configManagerConfig
module.exports.buildStackable = buildStackable
module.exports.schema = schema
module.exports.schemaComponents = schemaComponents
module.exports.version = packageJson.version
module.exports.getTypescriptCompilationOptions = getTypescriptCompilationOptions

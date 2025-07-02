'use strict'

const { resolveStackable } = require('@platformatic/basic')
const { ConfigManager } = require('@platformatic/config')
const { configManagerConfig, getTypescriptCompilationOptions } = require('@platformatic/service')
const { Generator } = require('./lib/generator')
const { ComposerStackable } = require('./lib/stackable')
const { platformaticComposer } = require('./lib/application')
const { schema, packageJson } = require('./lib/schema')
const schemaComponents = require('./lib/schema')
const errors = require('./lib/errors')

// This will be replaced by create before the release of v3
async function buildStackable (opts) {
  return create(opts.context.directory, opts.config, {}, opts.context)
}

async function create (configFileOrRoot, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(configFileOrRoot, sourceOrConfig, 'composer')
  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  const configManager = new ConfigManager({ schema, source, ...configManagerConfig, dirname: root, context })
  await configManager.parseAndValidate()

  return new ComposerStackable(opts, root, configManager)
}

module.exports.Generator = Generator
module.exports.ComposerStackable = ComposerStackable
module.exports.errors = errors
module.exports.platformaticComposer = platformaticComposer
module.exports.create = create
module.exports.skipTelemetryHooks = true
// Old exports - These might be removed in a future PR
module.exports.configType = 'composer'
module.exports.configManagerConfig = configManagerConfig
module.exports.buildStackable = buildStackable
module.exports.schema = schema
module.exports.schemaComponents = schemaComponents
module.exports.version = packageJson.version
module.exports.getTypescriptCompilationOptions = getTypescriptCompilationOptions

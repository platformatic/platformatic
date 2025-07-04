'use strict'

const { createConfigManager, resolveStackable, sanitizeCreationArguments } = require('@platformatic/basic')
const { configManagerConfig, getTypescriptCompilationOptions } = require('@platformatic/service')
const { Generator } = require('./lib/generator')
const { ComposerStackable } = require('./lib/stackable')
const { platformaticComposer } = require('./lib/application')
const { fetchOpenApiSchemas } = require('./lib/commands/openapi-fetch-schemas')
const { schema, packageJson } = require('./lib/schema')
const schemaComponents = require('./lib/schema')
const { upgrade } = require('./lib/upgrade')
const errors = require('./lib/errors')

// This will be replaced by create before the release of v3
async function buildStackable (opts) {
  return create(opts.context.directory, opts.config, {}, opts.context)
}

async function create (configFileOrRoot, sourceOrConfig, rawOpts, rawContext) {
  const { root, source } = await resolveStackable(configFileOrRoot, sourceOrConfig, 'composer')
  const { opts, context } = await sanitizeCreationArguments(root, rawOpts, rawContext)

  const configManager = await createConfigManager(
    { schema, upgrade, config: configManagerConfig, version: packageJson.version },
    root,
    source,
    opts,
    context
  )

  return new ComposerStackable(opts, root, configManager)
}

function createCommands (id) {
  return {
    commands: {
      [`${id}:fetch-openapi-schemas`]: fetchOpenApiSchemas
    },
    help: {
      [`${id}:fetch-openapi-schemas`]: {
        usage: `${id}:fetch-openapi-schemas`,
        description: 'Fetch OpenAPI schemas from remote services'
      }
    }
  }
}

module.exports.Generator = Generator
module.exports.ComposerStackable = ComposerStackable
module.exports.errors = errors
module.exports.platformaticComposer = platformaticComposer
module.exports.create = create
module.exports.createCommands = createCommands
module.exports.skipTelemetryHooks = true
// Old exports - These might be removed in a future PR
module.exports.configType = 'composer'
module.exports.configManagerConfig = configManagerConfig
module.exports.buildStackable = buildStackable
module.exports.schema = schema
module.exports.schemaComponents = schemaComponents
module.exports.version = packageJson.version
module.exports.getTypescriptCompilationOptions = getTypescriptCompilationOptions

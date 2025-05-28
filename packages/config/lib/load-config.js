'use strict'

const { Store } = require('./store')
const { readFile } = require('node:fs/promises')
const { dirname, resolve } = require('path')
const parseArgs = require('minimist')
const deepmerge = require('@fastify/deepmerge')
const errors = require('./errors')
const { getParser } = require('./formats')
const { ConfigManager } = require('./manager')
const { matchKnownSchema } = require('./store')

async function loadConfig (minimistConfig, args, app, overrides = {}, replaceEnv = true, logger = null, opts = {}) {
  const providedArgs = parseArgs(
    args,
    deepmerge({ all: true })(
      {
        alias: {
          v: 'version',
          c: 'config'
        }
      },
      minimistConfig
    )
  )

  let store
  if (app instanceof Store) {
    store = app
    app = null
  } else {
    store = new Store({ logger })
    store.add(app)
  }

  const loaded = await store.loadConfig({
    app,
    directory: providedArgs.config && dirname(providedArgs.config),
    config: providedArgs.config,
    overrides
  })

  app = loaded.app
  const configManager = loaded.configManager

  const parsingResult = await configManager.parse(replaceEnv, args, opts)
  if (!parsingResult && !opts.allowInvalid) {
    const err = new errors.ConfigurationDoesNotValidateAgainstSchemaError()
    err.validationErrors = configManager.validationErrors
    throw err
  }

  return { configManager, args: providedArgs, app, configType: app.configType }
}

async function loadEmptyConfig (path, app, overrides, replaceEnv, logger) {
  const store = new Store({ logger })
  store.add(app)

  const loaded = await store.loadEmptyConfig({ app, directory: path })
  const configManager = loaded.configManager

  return { configManager, args: {}, app, configType: app.configType }
}

async function loadConfigurationFile (configurationFile) {
  const parseConfig = getParser(configurationFile)

  return parseConfig(await readFile(configurationFile, 'utf-8'))
}

async function findConfigurationFile (root, configurationFile, schemas, typeOrCandidates) {
  if (schemas && !Array.isArray(schemas)) {
    schemas = [schemas]
  }

  let current = root

  while (!configurationFile) {
    // Find a wattpm.json or watt.json file
    configurationFile = await ConfigManager.findConfigFile(current, typeOrCandidates)

    // If a file is found, verify it actually represents a watt or runtime configuration
    if (configurationFile) {
      const configuration = await loadConfigurationFile(resolve(current, configurationFile))

      if (schemas && !schemas.includes(matchKnownSchema(configuration.$schema))) {
        configurationFile = null
      }
    }

    if (!configurationFile) {
      const newCurrent = dirname(current)

      if (newCurrent === current) {
        break
      }

      current = newCurrent
    }
  }

  if (typeof configurationFile !== 'string') {
    return null
  }

  const resolved = resolve(current, configurationFile)
  return resolved
}

function printConfigValidationErrors (err) {
  const tabularData = err.validationErrors.map(err => {
    return {
      path: err.path,
      message: err.message
    }
  })
  console.table(tabularData, ['path', 'message'])
}

function printAndExitLoadConfigError (err) {
  if (err.filenames) {
    console.error(`Missing config file!
Be sure to have a config file with one of the following names:

${err.filenames.map(s => ' * ' + s).join('\n')}

In alternative run "npm create platformatic@latest" to generate a basic platformatic service config.`)
    process.exit(1)
  } else if (err.validationErrors) {
    printConfigValidationErrors(err)
    process.exit(1)
  } else {
    console.error(err)
    process.exit(1)
  }
}

module.exports.loadConfig = loadConfig
module.exports.loadEmptyConfig = loadEmptyConfig
module.exports.loadConfigurationFile = loadConfigurationFile
module.exports.findConfigurationFile = findConfigurationFile
module.exports.printConfigValidationErrors = printConfigValidationErrors
module.exports.printAndExitLoadConfigError = printAndExitLoadConfigError

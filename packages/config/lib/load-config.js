'use strict'

const { Store } = require('./store')
const { dirname } = require('path')
const parseArgs = require('minimist')
const deepmerge = require('@fastify/deepmerge')
const errors = require('./errors')

async function loadConfig (minimistConfig, _args, app, overrides = {}, replaceEnv = true, logger) {
  const args = parseArgs(_args, deepmerge({ all: true })({
    string: ['allow-env'],
    default: {
      allowEnv: '' // The default is set in ConfigManager
    },
    alias: {
      v: 'version',
      c: 'config',
      allowEnv: ['allow-env', 'E']
    }
  }, minimistConfig))

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
    directory: args.config && dirname(args.config),
    config: args.config,
    allowEnv: args.allowEnv,
    overrides
  })

  app = loaded.app
  const configManager = loaded.configManager

  const parsingResult = await configManager.parse(replaceEnv)
  if (!parsingResult) {
    const err = new errors.ConfigurationDoesNotValidateAgainstSchemaError()
    err.validationErrors = configManager.validationErrors
    throw err
  }

  return { configManager, args, app, configType: app.configType }
}

function printConfigValidationErrors (err) {
  const tabularData = err.validationErrors.map((err) => {
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

${err.filenames.map((s) => ' * ' + s).join('\n')}

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
module.exports.printConfigValidationErrors = printConfigValidationErrors
module.exports.printAndExitLoadConfigError = printAndExitLoadConfigError

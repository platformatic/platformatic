'use strict'

const { Store } = require('./store')
const parseArgs = require('minimist')
const deepmerge = require('@fastify/deepmerge')

async function loadConfig (minimistConfig, _args, app, overrides = {}) {
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
    store = new Store()
    store.add(app)
  }

  const configManager = await store.loadConfig({
    app,
    config: args.config,
    allowEnv: args.allowEnv,
    overrides
  })

  try {
    const parsingResult = await configManager.parse()
    if (!parsingResult) {
      const err = new Error('The configuration does not validate against the configuration schema')
      err.validationErrors = configManager.validationErrors
      throw err
    }
  } finally {
    configManager.stopWatching()
  }

  return { configManager, args }
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

In alternative run "npm create platformatic@latest" to generate a basic plt service config.`)
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

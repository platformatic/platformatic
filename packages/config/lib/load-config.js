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

  let configManager
  try {
    configManager = await store.loadConfig({
      app,
      config: args.config,
      allowEnv: args.allowEnv,
      overrides
    })
  } catch (err) {
    // TODO refactor this file to avoid process.exit calls
    // ignoring for now
    /* istanbul ignore next */
    if (err.filenames) {
      console.error(`
  Missing config file!
  Be sure to have a config file with one of the following names:

  ${err.filenames.map((s) => ' * ' + s).join('\n')}

  In alternative run "npm create platformatic@latest" to generate a basic plt service config.
  Error: ${err}
  `)
      process.exit(1)
    } else {
      console.error(err)
      process.exit(1)
    }
  }

  try {
    const parsingResult = await configManager.parse()
    if (!parsingResult) {
      printConfigValidationErrors(configManager)
      process.exit(1)
    }
  } finally {
    configManager.stopWatching()
  }

  return { configManager, args }
}

function printConfigValidationErrors (configManager) {
  const tabularData = configManager.validationErrors.map((err) => {
    return {
      path: err.path,
      message: err.message
    }
  })
  console.table(tabularData, ['path', 'message'])
}

module.exports.loadConfig = loadConfig

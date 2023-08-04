'use strict'
const { Store, loadConfig, printConfigValidationErrors } = require('@platformatic/config')
const {
  platformaticService,
  buildServer,
  start
} = require('@platformatic/service')
const {
  platformaticDB
} = require('@platformatic/db')
const {
  platformaticComposer
} = require('@platformatic/composer')
const { buildServer: runtimeBuildServer } = require('./build-server')
const { platformaticRuntime, wrapConfigInRuntimeConfig } = require('./config')
const {
  start: runtimeStart,
  startWithConfig: runtimeStartWithConfig
} = require('./start')

const store = new Store()
store.add(platformaticService)
store.add(platformaticDB)
store.add(platformaticComposer)
store.add(platformaticRuntime)

/* c8 ignore next 10 - for some reason c8 is not seeing this as covered. */
async function _buildServer (options) {
  if (typeof options === 'string') {
    const config = await _loadConfig({}, ['-c', options])
    options = config.configManager.current
    options.app = config.app
  }

  const app = options.app

  delete options.app

  if (app === platformaticRuntime) {
    return runtimeBuildServer(options)
  }

  return buildServer(options, app)
}

function _loadConfig (minimistConfig, args, overrides) {
  return loadConfig(minimistConfig, args, store, overrides)
}

async function _start (args) {
  const config = await _loadConfig({}, args)

  if (config.configType === 'runtime') {
    return runtimeStart(args)
  }

  return start(config.app, args)
}

async function startCommand (args) {
  try {
    const config = await _loadConfig({}, args)
    let runtime

    if (config.configType === 'runtime') {
      config.configManager.args = config.args
      runtime = await runtimeStartWithConfig(config.configManager)
    } else {
      const wrappedConfig = await wrapConfigInRuntimeConfig(config)
      wrappedConfig.args = config.args
      runtime = await runtimeStartWithConfig(wrappedConfig)
    }

    return await runtime.start()
  } catch (err) {
    logErrorAndExit(err)
  }
}

function logErrorAndExit (err) {
  if (err.filenames) {
    console.error(`Missing config file!
Be sure to have a config file with one of the following names:

${err.filenames.map((s) => ' * ' + s).join('\n')}

In alternative run "npm create platformatic@latest" to generate a basic plt service config.`)
    process.exit(1)
  } else if (err.validationErrors) {
    printConfigValidationErrors(err)
    process.exit(1)
  }

  delete err?.stack
  console.error(err?.message)

  if (err?.cause) {
    console.error(`${err.cause}`)
  }

  process.exit(1)
}

module.exports = {
  buildServer: _buildServer,
  loadConfig: _loadConfig,
  start: _start,
  startCommand
}

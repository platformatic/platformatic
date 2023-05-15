'use strict'
const { resolve } = require('node:path')
const parseArgs = require('minimist')
const ConfigManager = require('@platformatic/config')
const {
  schema: dbSchema,
  platformaticDB
} = require('@platformatic/db')
const {
  platformaticService,
  buildServer,
  loadConfig,
  start,
  schema: serviceSchema
} = require('@platformatic/service')
const kSupportedAppTypes = new Set(['service', 'db'])

async function tryGetConfigTypeFromSchema (config) {
  if (typeof config === 'string') {
    // Handle config file paths.
    const loadedConfig = await loadConfig({}, ['-c', config], platformaticService)

    config = loadedConfig.configManager.current
  }

  const schema = config?.$schema

  if (typeof schema !== 'string') {
    throw new Error('configuration is missing a schema')
  }

  const configType = schema.split('/').pop()

  if (!kSupportedAppTypes.has(configType)) {
    throw new Error(`unknown configuration type: '${configType}'`)
  }

  return configType
}

async function getConfigType (args = [], directory) {
  try {
    // The config type was not specified, so we need to figure it out.
    // Try to get the config file from the provided arguments.
    let { config } = parseArgs(args, { alias: { c: 'config' } })

    if (!config) {
      // Couldn't get the config file from the arguments, so look in the
      // provided directory (or current directory) for any recognized
      // config files.
      const searchDir = directory ?? process.cwd()
      const configFile = await ConfigManager.findConfigFile(searchDir)

      config = resolve(searchDir, configFile)
    }

    // At this point, we have the config file. However, several different
    // file formats are supported, so use the config manager to parse the
    // file (without worrying about the validity of the file). We can then
    // use the $schema field to determine the config type.
    const configManager = new ConfigManager({ source: config })
    const configString = await configManager.load()
    const parsedConfig = configManager._parser(configString)

    return await tryGetConfigTypeFromSchema(parsedConfig)
  } catch (err) {
    const configFiles = ConfigManager.listConfigFiles()
    const msg = `
Missing config file!
Be sure to have a config file with one of the following names: ${configFiles.join('\n')}
Alternatively run "npm create platformatic@latest" to generate a basic plt service config.
`

    throw new Error(msg, { cause: err })
  }
}

async function getCurrentSchema (configType) {
  if (configType === 'service') {
    return serviceSchema.schema
  } else if (configType === 'db') {
    return dbSchema
  }

  throw new Error(`unknown configuration type: '${configType}'`)
}

async function _buildServer (options) {
  const configType = await tryGetConfigTypeFromSchema(options)
  const app = getApp(configType)

  return buildServer(options, app)
}

function getApp (configType) {
  let app

  if (configType === 'service') {
    app = platformaticService
  } else if (configType === 'db') {
    app = platformaticDB
  } else {
    throw new Error('unknown kind: ' + configType)
  }

  return app
}

async function _loadConfig (minimistConfig, args, configType, overrides) {
  // If the config type was specified, then use that. Otherwise, compute it.
  if (typeof configType !== 'string') {
    configType = await getConfigType(args)
  }

  return loadConfig(minimistConfig, args, getApp(configType), overrides)
}

async function _start (args) {
  const configType = await getConfigType(args)

  return start(getApp(configType), args)
}

async function startCommand (args) {
  try {
    await _start(args)
  } catch (err) {
    delete err?.stack
    console.error(err?.message)

    if (err?.cause) {
      console.error(`${err.cause}`)
    }

    process.exit(1)
  }
}

module.exports = {
  buildServer: _buildServer,
  getConfigType,
  getCurrentSchema,
  loadConfig: _loadConfig,
  start: _start,
  startCommand
}

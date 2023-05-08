'use strict'
const { resolve } = require('node:path')
const parseArgs = require('minimist')
const ConfigManager = require('@platformatic/config')
const {
  buildServer: dbBuildServer
} = require('@platformatic/db')
const {
  buildServer: serviceBuildServer,
  loadConfig: serviceLoadConfig
} = require('@platformatic/service')
const kSupportedAppTypes = new Set(['service', 'db'])

function tryGetConfigTypeFromSchema (config) {
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

async function getConfigType (args, directory) {
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

    return tryGetConfigTypeFromSchema(parsedConfig)
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

async function buildServer (options) {
  const configType = tryGetConfigTypeFromSchema(options)
  let buildServerFn

  if (configType === 'service') {
    buildServerFn = serviceBuildServer
  } else if (configType === 'db') {
    buildServerFn = dbBuildServer
  }

  return buildServerFn(options)
}

async function loadConfig (minimistConfig, args, defaultConfig, configType) {
  // If the config type was specified, then use that. Otherwise, compute it.
  if (typeof configType !== 'string') {
    configType = await getConfigType(args)
  }

  let configLoader

  if (configType === 'service') {
    configLoader = serviceLoadConfig
  } else if (configType === 'db') {
    const { loadConfig: dbLoadConfig } = await import('@platformatic/db/lib/load-config.mjs')
    configLoader = dbLoadConfig
  }

  return configLoader(minimistConfig, args, defaultConfig)
}

async function start (args) {
  const configType = await getConfigType(args)
  let startFn

  if (configType === 'service') {
    const start = await import('@platformatic/service/lib/start.mjs')
    startFn = start.default
  } else if (configType === 'db') {
    const { start } = await import('@platformatic/db/lib/start.mjs')
    startFn = start
  }

  return startFn(args)
}

async function startCommand (...args) {
  try {
    await start(...args)
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
  buildServer,
  getConfigType,
  loadConfig,
  start,
  startCommand
}

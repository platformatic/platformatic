'use strict'

const parseArgs = require('minimist')
const { access } = require('fs/promises')
const ConfigManager = require('@platformatic/config')
const deepmerge = require('@fastify/deepmerge')
const { schema } = require('./schema.js')

function generateDefaultConfig () {
  return {
    schema,
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    }
  }
}

// Unfortunately c8 does not see those on Windows
/* c8 ignore next 70 */
async function loadConfig (minimistConfig, _args, defaultConfig, configType = 'service') {
  defaultConfig ??= generateDefaultConfig()
  const args = parseArgs(_args, deepmerge({ all: true })({
    string: ['allow-env'],
    boolean: ['hotReload'],
    default: {
      allowEnv: '', // The default is set in ConfigManager
      hotReload: true
    },
    alias: {
      v: 'version',
      c: 'config',
      allowEnv: ['allow-env', 'E'],
      hotReload: ['hot-reload']
    }
  }, minimistConfig))

  try {
    if (!args.config) {
      args.config = await ConfigManager.findConfigFile(process.cwd(), configType)
    }
    await access(args.config)
  } catch (err) {
    const configFiles = ConfigManager.listConfigFiles(configType)
    console.error(`
Missing config file!
Be sure to have a config file with one of the following names: ${configFiles.join('\n')}
In alternative run "npm create platformatic@latest" to generate a basic plt service config.
Error: ${err}
`)
    process.exit(1)
  }

  const envWhitelist = args.allowEnv ? args.allowEnv : defaultConfig.envWhitelist
  const configManager = new ConfigManager({
    source: args.config,
    ...defaultConfig,
    envWhitelist
  })

  const parsingResult = await configManager.parse()
  if (!parsingResult) {
    printConfigValidationErrors(configManager)
    process.exit(1)
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
module.exports.generateDefaultConfig = generateDefaultConfig

'use strict'

const parseArgs = require('minimist')
const { access } = require('fs/promises')
const ConfigManager = require('./config.js')
const deepmerge = require('@fastify/deepmerge')
const { findConfigFile } = require('./utils.js')

const ourConfigFiles = [
  'platformatic.service.json',
  'platformatic.service.json5',
  'platformatic.service.yaml',
  'platformatic.service.yml',
  'platformatic.service.toml',
  'platformatic.service.tml'
]

async function loadConfig (minimistConfig, _args, configOpts = {}, Manager = ConfigManager, configFileNames = ourConfigFiles) {
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
      args.config = await findConfigFile(process.cwd(), configFileNames)
    }
    await access(args.config)
  } catch (err) {
    console.error('Missing config file')
    process.exit(1)
  }

  const configManager = new Manager({
    source: args.config,
    envWhitelist: [...args.allowEnv.split(',')],
    ...configOpts
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

module.exports = loadConfig

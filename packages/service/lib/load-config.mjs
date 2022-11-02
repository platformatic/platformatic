import parseArgs from 'minimist'
import { access } from 'fs/promises'
import ConfigManager from './config.js'
import deepmerge from '@fastify/deepmerge'
import { findConfigFile } from './utils.js'

async function loadConfig (minimistConfig, _args, configOpts = {}) {
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
  try {
    if (!args.config) {
      args.config = await findConfigFile(process.cwd())
    }
    await access(args.config)
  } catch (err) {
    console.error('Missing config file')
    process.exit(1)
  }

  const configManager = new ConfigManager({
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

export default loadConfig

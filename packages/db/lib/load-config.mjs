import parseArgs from 'minimist'
import { access } from 'fs/promises'
import { resolve } from 'path'
import ConfigManager from './config.js'
import deepmerge from '@fastify/deepmerge'

async function loadConfig (minimistConfig, _args, configOpts = {}) {
  const args = parseArgs(_args, deepmerge({ all: true })({
    string: ['allow-env'],
    default: {
      config: resolve(process.cwd(), 'platformatic.db.json'),
      allowEnv: '' // The default is set in ConfigManager
    },
    alias: {
      v: 'version',
      c: 'config',
      allowEnv: ['allow-env', 'E']
    }
  }, minimistConfig))
  try {
    await access(args.config)
  } catch (err) {
    console.error('Missing config file')
    process.exit(1)
  }
  let watchIgnore = []
  // Apparently C8 cannot detect these three lines on Windows
  /* c8 ignore next 3 */
  if (args['watch-ignore']) {
    watchIgnore = args['watch-ignore'].split(',')
  }
  const configManager = new ConfigManager({
    source: args.config,
    envWhitelist: [...args.allowEnv.split(',')],
    watchIgnore,
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

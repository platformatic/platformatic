import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import parseArgs from 'minimist'
import { findConfigFile, isFileAccessible } from './utils.js'
import loadConfig from './load-config.js'

function generateConfig (args) {
  const { hostname, port } = args

  const plugin = [
    './plugins',
    './routes'
  ]

  const config = {
    server: { hostname, port },
    plugin
  }

  /*
  if (typescript === true) {
    config.plugin.typescript = {
      outDir: 'dist'
    }
  }
  */

  return config
}

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}

module.exports[Symbol.for('skip-override')] = true
`

const ROUTES_WITH_TYPES_SUPPORT = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    return { hello: app.example }
  })
}
`

async function init (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      port: 3042,
      typescript: false
    },
    alias: {
      h: 'hostname',
      p: 'port',
      ts: 'typescript'
    },
    boolean: ['typescript']
  })

  const currentDir = process.cwd()
  const configFileNames = [
    'platformatic.service.json',
    'platformatic.service.json5',
    'platformatic.service.yaml',
    'platformatic.service.yml',
    'platformatic.service.toml',
    'platformatic.service.tml'
  ]
  const accessibleConfigFilename = await findConfigFile(currentDir, configFileNames)

  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(args)
    await writeFile('platformatic.service.json', JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.service.json successfully created.')
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()

  const pluginFolderExists = await isFileAccessible('plugins', currentDir)
  if (!pluginFolderExists) {
    await mkdir('plugins')
    await writeFile(join('plugins', 'example.js'), JS_PLUGIN_WITH_TYPES_SUPPORT)
    logger.info('Plugins folder "plugins" successfully created.')
  } else {
    logger.info('Plugins folder "plugins" found, skipping creation of plugins folder.')
  }

  const routeFolderExists = await isFileAccessible('routes', currentDir)
  if (!routeFolderExists) {
    await mkdir('routes')
    await writeFile(join('routes', 'root.js'), ROUTES_WITH_TYPES_SUPPORT)
    logger.info('Routes folder "routes" successfully created.')
  } else {
    logger.info('Routes folder "routes" found, skipping creation of routes folder.')
  }
}

export { init }

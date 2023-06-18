import { writeFile, mkdir, readFile, appendFile } from 'fs/promises'
import { join } from 'path'
import * as desm from 'desm'
import { findServiceConfigFile, isFileAccessible } from '../utils.mjs'

const TS_OUT_DIR = 'dist'

function generateConfig (version, typescript) {
  const plugins = {
    paths: [
      { path: './plugins', encapsulate: false },
      './routes'
    ]
  }

  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/service`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    service: {
      openapi: true
    },
    plugins
  }

  if (typescript === true) {
    config.plugins.typescript = true
  }

  return config
}

function generateEnv (hostname, port) {
  const env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
`
  return env
}

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
`

const JS_ROUTES_WITH_TYPES_SUPPORT = `\
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TS_ROUTES_WITH_TYPES_SUPPORT = `\
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

function getTsConfig (outDir) {
  return {
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      target: 'es6',
      sourceMap: true,
      pretty: true,
      noEmitOnError: true,
      outDir
    },
    watchOptions: {
      watchFile: 'fixedPollingInterval',
      watchDirectory: 'fixedPollingInterval',
      fallbackPolling: 'dynamicPriority',
      synchronousWatchDirectory: true,
      excludeDirectories: ['**/node_modules', outDir]
    }
  }
}

async function generatePluginWithTypesSupport (logger, currentDir, isTypescript) {
  await mkdir(join(currentDir, 'plugins'))
  const pluginTemplate = isTypescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT
  const pluginName = isTypescript
    ? 'example.ts'
    : 'example.js'
  await writeFile(join(currentDir, 'plugins', pluginName), pluginTemplate)
  logger.info('Plugins folder "plugins" successfully created.')
}

async function generateRouteWithTypesSupport (logger, currentDir, isTypescript) {
  await mkdir(join(currentDir, 'routes'))
  const routesTemplate = isTypescript
    ? TS_ROUTES_WITH_TYPES_SUPPORT
    : JS_ROUTES_WITH_TYPES_SUPPORT
  const routesName = isTypescript
    ? 'root.ts'
    : 'root.js'
  await writeFile(join(currentDir, 'routes', routesName), routesTemplate)
  logger.info('Routes folder "routes" successfully created.')
}

async function createService ({ hostname, port, typescript = false }, logger, currentDir = process.cwd(), version) {
  if (!version) {
    const pkg = await readFile(desm.join(import.meta.url, '..', '..', 'package.json'))
    version = JSON.parse(pkg).version
  }
  const accessibleConfigFilename = await findServiceConfigFile(currentDir)

  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(version, typescript)
    await writeFile(join(currentDir, 'platformatic.service.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.service.json successfully created.')

    const env = generateEnv(hostname, port)
    const envFileExists = await isFileAccessible('.env', currentDir)
    await appendFile(join(currentDir, '.env'), env)
    await writeFile(join(currentDir, '.env.sample'), env)
    /* c8 ignore next 5 */
    if (envFileExists) {
      logger.info('Environment file .env found, appending new environment variables to existing .env file.')
    } else {
      logger.info('Environment file .env successfully created.')
    }
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  if (typescript === true) {
    const tsConfigFileName = join(currentDir, 'tsconfig.json')
    const isTsConfigExists = await isFileAccessible(tsConfigFileName)
    if (!isTsConfigExists) {
      const tsConfig = getTsConfig(TS_OUT_DIR)
      await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
      logger.info(
        `Typescript configuration file ${tsConfigFileName} successfully created.`
      )
    } else {
      logger.info(
        `Typescript configuration file ${tsConfigFileName} found, skipping creation of typescript configuration file.`
      )
    }
  }

  const pluginFolderExists = await isFileAccessible('plugins', currentDir)
  if (!pluginFolderExists) {
    await generatePluginWithTypesSupport(logger, currentDir, typescript)
  } else {
    logger.info('Plugins folder "plugins" found, skipping creation of plugins folder.')
  }

  const routeFolderExists = await isFileAccessible('routes', currentDir)
  if (!routeFolderExists) {
    await generateRouteWithTypesSupport(logger, currentDir, typescript)
  } else {
    logger.info('Routes folder "routes" found, skipping creation of routes folder.')
  }

  return {
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createService

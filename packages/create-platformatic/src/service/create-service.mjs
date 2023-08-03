import { writeFile, mkdir, readFile, appendFile } from 'fs/promises'
import { join } from 'path'
import * as desm from 'desm'
import { findServiceConfigFile, isFileAccessible } from '../utils.mjs'
import { getTsConfig } from '../get-tsconfig.mjs'

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
    config.plugins.typescript = '{PLT_TYPESCRIPT}'
  }

  return config
}

function generateEnv (hostname, port, typescript) {
  let env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
`

  if (typescript === true) {
    env += `\

# Set to false to disable automatic typescript compilation.
# Changing this setting is needed for production
PLT_TYPESCRIPT=true
`
  }

  return env
}

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
`

const JS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
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

const TEST_HELPER_JS = `\
'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { buildServer } = require('@platformatic/service')

async function getServer () {
  const config = JSON.parse(await readFile(join(__dirname, '..', 'platformatic.service.json'), 'utf8'))
  config.server.logger.level = 'warn'
  config.watch = false
  return buildServer(config)
}

module.exports.getServer = getServer
`

const TEST_ROUTES_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('root', async (t) => {
  const server = await getServer()
  t.after(() => server.close())
  const res = await server.inject({
    method: 'GET',
    url: '/'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example decorator', async (t) => {
  const server = await getServer()
  t.after(() => server.close())

  assert.strictEqual(server.example, 'foobar')
})
`

const TEST_HELPER_TS = `\
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { buildServer } from '@platformatic/service'

export async function getServer () {
  // We go up two folder because this files executes in the dist folder
  const config = JSON.parse(await readFile(join(__dirname, '..', '..', 'platformatic.service.json'), 'utf8'))
  config.server.logger.level = 'warn'
  config.watch = false
  return buildServer(config)
}
`

const TEST_ROUTES_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('root', async (t) => {
  const server = await getServer()
  t.after(() => server.close())
  const res = await server.inject({
    method: 'GET',
    url: '/'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('example decorator', async (t) => {
  const server = await getServer()
  t.after(() => server.close())

  assert.strictEqual(server.example, 'foobar')
})
`

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

async function generateTests (logger, currentDir, isTypescript) {
  await mkdir(join(currentDir, 'test'))
  await mkdir(join(currentDir, 'test', 'plugins'))
  await mkdir(join(currentDir, 'test', 'routes'))

  if (isTypescript) {
    await writeFile(join(currentDir, 'test', 'helper.ts'), TEST_HELPER_TS)
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.ts'), TEST_PLUGIN_TS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.ts'), TEST_ROUTES_TS)
  } else {
    await writeFile(join(currentDir, 'test', 'helper.js'), TEST_HELPER_JS)
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.js'), TEST_PLUGIN_JS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.js'), TEST_ROUTES_JS)
  }

  logger.info('Test folder "tests" successfully created.')
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

    const env = generateEnv(hostname, port, typescript)
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

  const testFolderExists = await isFileAccessible('tests', currentDir)
  if (!testFolderExists) {
    await generateTests(logger, currentDir, typescript)
  } else {
    logger.info('Test folder found, skipping creation of tests.')
  }

  return {
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createService

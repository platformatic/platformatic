import { join } from 'path'
import { writeFile } from 'fs/promises'
import { safeMkdir } from './utils.mjs'

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference path="../global.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
`

const JS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference path="../global.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference path="../global.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

function testHelperJS (mod, customization = { pre: '', post: '', config: '' }) {
  return `\
'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { buildServer } = require('@platformatic/${mod}')
${customization.requires || ''}

async function getServer (t) {
${customization.pre || ''}
  const config = JSON.parse(await readFile(join(__dirname, '..', 'platformatic.${mod}.json'), 'utf8'))
  // Add your config customizations here. For example you want to set
  // all things that are set in the config file to read from an env variable
  config.server.logger.level = 'warn'
  config.watch = false
${customization.config || ''}
  // Add your config customizations here
  const server = await buildServer(config)
  t.after(() => server.close())
${customization.post || ''}
  return server
}

module.exports.getServer = getServer
`
}

const TEST_ROUTES_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example', async (t) => {
  const server = await getServer(t)
  const res = await server.inject({
    method: 'GET',
    url: '/example'
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
  const server = await getServer(t)

  assert.strictEqual(server.example, 'foobar')
})
`

function testHelperTS (mod, customizations = { pre: '', post: '', config: '', requires: '' }) {
  return `\
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { buildServer } from '@platformatic/${mod}'
${customizations.requires}

export async function getServer (t) {
${customizations.pre}
  // We go up two folder because this files executes in the dist folder
  const config = JSON.parse(await readFile(join(__dirname, '..', '..', 'platformatic.${mod}.json'), 'utf8'))
  // Add your config customizations here. For example you want to set
  // all things that are set in the config file to read from an env variable
  config.server.logger.level = 'warn'
  config.watch = false
${customizations.config}
  // Add your config customizations here
  const server = await buildServer(config)
  t.after(() => server.close())
${customizations.post}
  return server
}
  `
}

const TEST_ROUTES_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('root', async (t) => {
  const server = await getServer(t)
  const res = await server.inject({
    method: 'GET',
    url: '/example'
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
  const server = await getServer(t)

  assert.strictEqual(server.example, 'foobar')
})
`

export async function generatePluginWithTypesSupport (logger, currentDir, isTypescript) {
  await safeMkdir(join(currentDir, 'plugins'))
  const pluginTemplate = isTypescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT
  const pluginName = isTypescript
    ? 'example.ts'
    : 'example.js'
  await writeFile(join(currentDir, 'plugins', pluginName), pluginTemplate)
  logger.info('Plugins folder "plugins" successfully created.')
}

export async function generateRouteWithTypesSupport (logger, currentDir, isTypescript) {
  await safeMkdir(join(currentDir, 'routes'))
  const routesTemplate = isTypescript
    ? TS_ROUTES_WITH_TYPES_SUPPORT
    : JS_ROUTES_WITH_TYPES_SUPPORT
  const routesName = isTypescript
    ? 'root.ts'
    : 'root.js'
  await writeFile(join(currentDir, 'routes', routesName), routesTemplate)
  logger.info('Routes folder "routes" successfully created.')
}

export async function generateTests (logger, currentDir, isTypescript, mod, customizations) {
  await safeMkdir(join(currentDir, 'test'))
  await safeMkdir(join(currentDir, 'test', 'plugins'))
  await safeMkdir(join(currentDir, 'test', 'routes'))

  if (isTypescript) {
    await writeFile(join(currentDir, 'test', 'helper.ts'), testHelperTS(mod, customizations))
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.ts'), TEST_PLUGIN_TS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.ts'), TEST_ROUTES_TS)
  } else {
    await writeFile(join(currentDir, 'test', 'helper.js'), testHelperJS(mod, customizations))
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.js'), TEST_PLUGIN_JS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.js'), TEST_ROUTES_JS)
  }

  logger.info('Test folder "tests" successfully created.')
}

export async function generatePlugins (logger, currentDir, isTypescript, mod, helperCustomization) {
  await generatePluginWithTypesSupport(logger, currentDir, isTypescript)
  await generateRouteWithTypesSupport(logger, currentDir, isTypescript)
  await generateTests(logger, currentDir, isTypescript, mod, helperCustomization)
}

'use strict'

const { join } = require('path')

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
import { test } from 'node:test'
${customizations.requires}

type testfn = Parameters<typeof test>[0]
type TestContext = Parameters<Exclude<testfn, undefined>>[0]

export async function getServer (t: TestContext) {
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

function generatePluginWithTypesSupport (typescript) {
  const pluginTemplate = typescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT
  const pluginName = typescript
    ? 'example.ts'
    : 'example.js'
  return {
    path: 'plugins',
    file: pluginName,
    contents: pluginTemplate
  }
}

function generateRouteWithTypesSupport (typescript) {
  const routesTemplate = typescript
    ? TS_ROUTES_WITH_TYPES_SUPPORT
    : JS_ROUTES_WITH_TYPES_SUPPORT
  const routesName = typescript
    ? 'root.ts'
    : 'root.js'
  return {
    path: 'routes',
    file: routesName,
    contents: routesTemplate
  }
}

function generateTests (typescript, type, customizations) {
  const output = []
  if (typescript) {
    output.push({
      path: 'test',
      file: 'helper.ts',
      contents: testHelperTS(type, customizations)
    })
    output.push({
      path: join('test', 'plugins'),
      file: 'example.test.ts',
      contents: TEST_PLUGIN_TS
    })
    output.push({
      path: join('test', 'routes'),
      file: 'root.test.ts',
      contents: TEST_ROUTES_TS
    })
  } else {
    output.push({
      path: 'test',
      file: 'helper.js',
      contents: testHelperJS(type, customizations)
    })
    output.push({
      path: join('test', 'plugins'),
      file: 'example.test.js',
      contents: TEST_PLUGIN_JS
    })
    output.push({
      path: join('test', 'routes'),
      file: 'root.test.js',
      contents: TEST_ROUTES_JS
    })
  }
  return output
}

function generatePlugins (typescript) {
  const files = []
  files.push(generatePluginWithTypesSupport(typescript))
  files.push(generateRouteWithTypesSupport(typescript))
  return files
}

module.exports = {
  generatePluginWithTypesSupport,
  generateRouteWithTypesSupport,
  generatePlugins,
  generateTests
}

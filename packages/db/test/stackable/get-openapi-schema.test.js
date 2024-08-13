'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildConfigManager, getConnectionInfo } = require('../helper')
const { buildStackable } = require('../..')

test('get service openapi schema via stackable api', async (t) => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      ...connectionInfo,
    },
    plugins: {
      paths: [join(workingDir, 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const configManager = await buildConfigManager(config, workingDir)
  const stackable = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenAPISchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    description: 'Exposing a SQL database as REST',
    title: 'Platformatic DB',
    version: '1.0.0',
  })
  assert.deepStrictEqual(openapiSchema.paths['/foo/baz/'], {
    get: {
      responses: {
        200: {
          description: 'Default Response',
        },
      },
    },
  })
})

test('get null if server does not expose openapi', async (t) => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      openapi: false,
      ...connectionInfo,
    },
    plugins: {
      paths: [join(workingDir, 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const configManager = await buildConfigManager(config, workingDir)
  const stackable = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenAPISchema()
  assert.strictEqual(openapiSchema, null)
})

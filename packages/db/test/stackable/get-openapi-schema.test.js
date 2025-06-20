'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackableFromConfig, getConnectionInfo } = require('../helper')

test('get service openapi schema via stackable api', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    description: 'Exposing a SQL database as REST',
    title: 'Platformatic DB',
    version: '1.0.0'
  })

  assert.deepStrictEqual(openapiSchema.paths['/foo/baz/'], {
    get: {
      responses: {
        200: {
          description: 'Default Response'
        }
      }
    }
  })
})

test('get null if server does not expose openapi', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      openapi: false,
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema, null)
})

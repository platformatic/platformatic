'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { isatty } = require('tty')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get service openapi schema', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
    ])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-1/openapi-schema',
  })

  assert.strictEqual(statusCode, 200)

  const openapiSchema = await body.json()

  const logger = {}
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty',
    }
  }

  assert.deepStrictEqual(openapiSchema,
    {
      openapi: '3.0.3',
      info: {
        title: 'Platformatic',
        description: 'This is a service built on top of Platformatic',
        version: '1.0.0',
      },
      servers: [
        {
          url: '/',
        },
      ],
      components: {
        schemas: {},
      },
      paths: {
        '/hello': {
          get: {
            responses: {
              200: {
                description: 'Default Response',
              },
            },
          },
        },
        '/large-logs': {
          get: {
            responses: {
              200: {
                description: 'Default Response',
              },
            },
          },
        },
      },
    }

  )
})

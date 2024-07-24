'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { isatty } = require('tty')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const platformaticVersion = require('../../package.json').version

test('should get service config', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
      app.managementApi.close()
    ])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-1/config'
  })

  assert.strictEqual(statusCode, 200)

  const serviceConfig = await body.json()

  const logger = {}
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty'
    }
  }

  assert.deepStrictEqual(serviceConfig, {
    $schema: `https://platformatic.dev/schemas/v${platformaticVersion}/service`,
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger,
      keepAliveTimeout: 5000
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(projectDir, 'services', 'service-1', 'plugin.js')
      ]
    },
    watch: {
      enabled: false
    },
    metrics: {
      server: 'hide',
      defaultMetrics: {
        enabled: true
      },
      labels: {
        serviceId: 'service-1'
      }
    }
  })
})

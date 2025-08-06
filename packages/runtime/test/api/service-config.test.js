'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get service config', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  assert.deepStrictEqual(serviceConfig, {
    application: {},
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      trustProxy: true,
      logger: serviceConfig.server.logger
    },
    service: { openapi: true },
    plugins: {
      paths: [join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js')]
    },
    watch: { enabled: true }
  })
})

test('do not force enable metrics without the management api', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  assert.deepStrictEqual(serviceConfig, {
    application: {},
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      trustProxy: true,
      logger: serviceConfig.server.logger
    },
    service: { openapi: true },
    plugins: {
      paths: [join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js')]
    },
    watch: { enabled: true }
  })
})

test('do not force enable metrics if they are set to false', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api-without-metrics.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('multi-plugin-service')

  delete serviceConfig.$schema

  assert.deepStrictEqual(serviceConfig, {
    application: {},
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      trustProxy: true,
      logger: serviceConfig.server.logger
    },
    service: { openapi: true },
    plugins: {
      paths: [
        {
          options: {
            name: 'plugin1'
          },
          path: join(fixturesDir, 'monorepo', 'serviceAppWithMultiplePlugins', 'plugin.js')
        },
        {
          options: {
            name: 'plugin2'
          },
          path: join(fixturesDir, 'monorepo', 'serviceAppWithMultiplePlugins', 'plugin2.mjs')
        }
      ]
    },
    watch: { enabled: true }
  })
})

test('set serviceId in metrics as label in all services', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-metrics.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  assert.deepStrictEqual(serviceConfig, {
    application: {},
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      trustProxy: true,
      logger: serviceConfig.server.logger
    },
    service: { openapi: true },
    plugins: {
      paths: [join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js')]
    },
    watch: {
      enabled: true
    }
  })
})

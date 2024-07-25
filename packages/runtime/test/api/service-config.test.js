'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get service config', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  let logger = {}
  if (process.stdout.isTTY) {
    logger = {
      transport: {
        target: 'pino-pretty',
      },
    }
  }

  assert.deepStrictEqual(serviceConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger,
      keepAliveTimeout: 5000,
      trustProxy: true,
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js'),
      ],
    },
    watch: {
      enabled: false,
    },
    metrics: {
      server: 'hide',
      defaultMetrics: {
        enabled: false,
      },
      prefix: 'with_logger_',
    },
  })
})

test('do not force enable metrics without the management api', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('with-logger')

  delete serviceConfig.$schema

  let logger = {}
  if (process.stdout.isTTY) {
    logger = {
      transport: {
        target: 'pino-pretty',
      },
    }
  }

  assert.deepStrictEqual(serviceConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger,
      keepAliveTimeout: 5000,
      trustProxy: true,
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(fixturesDir, 'monorepo', 'serviceAppWithLogger', 'plugin.js'),
      ],
    },
    watch: {
      enabled: false,
    },
  })
})

test('do not force enable metrics if they are set to false', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-management-api.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceConfig = await app.getServiceConfig('multi-plugin-service')

  delete serviceConfig.$schema

  let logger = {}
  if (process.stdout.isTTY) {
    logger = {
      transport: {
        target: 'pino-pretty',
      },
    }
  }

  assert.deepStrictEqual(serviceConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger,
      keepAliveTimeout: 5000,
      trustProxy: true,
    },
    service: { openapi: true },
    plugins: {
      paths: [
        {
          options: {
            name: 'plugin1',
          },
          path: join(fixturesDir, 'monorepo', 'serviceAppWithMultiplePlugins', 'plugin.js'),
        },
        {
          options: {
            name: 'plugin2',
          },
          path: join(fixturesDir, 'monorepo', 'serviceAppWithMultiplePlugins', 'plugin2.mjs'),
        },
      ],
    },
    watch: {
      enabled: false,
    },
    metrics: false,
  })
})

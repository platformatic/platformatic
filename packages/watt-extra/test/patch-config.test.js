import assert from 'node:assert'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { randomUUID } from 'node:crypto'
import { request } from 'undici'
import { setUpEnvironment, startICC, installDeps } from './helper.js'
import { start } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('should spawn a service app settings labels for metrics', async (t) => {
  const applicationName = 'test-application'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'service-1')

  const icc = await startICC(t, {
    applicationId,
    applicationName,
    enableOpenTelemetry: true,
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const mainConfig = app.wattpro.runtime.getRuntimeConfig(true)

  const { metrics, telemetry } = mainConfig

  const expectedTelemetry = {
    enabled: true,
    applicationName: 'test-application',
    skip: [
      {
        method: 'GET',
        path: '/documentation',
      },
      {
        method: 'GET',
        path: '/documentation/json',
      },
    ],
    exporter: {
      type: 'otlp',
      options: {
        url: 'http://127.0.0.1:3000/risk-service/v1/traces',
        headers: {
          'x-platformatic-application-id': applicationId,
        },
        keepAlive: true,
        httpAgentOptions: {
          rejectUnauthorized: false,
        },
      },
    },
  }
  assert.deepStrictEqual(telemetry, expectedTelemetry)

  const expectedMetrics = {
    server: 'hide',
    defaultMetrics: {
      enabled: true,
    },
    hostname: '127.0.0.1',
    port: 9090,
    labels: {
      serviceId: 'main',
      instanceId: app.instanceId,
      applicationId,
    },
  }
  assert.deepStrictEqual(metrics, expectedMetrics)
})

test('should configure system resources', async (t) => {
  const applicationName = 'test-next'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-next')

  await installDeps(t, applicationPath, ['@platformatic/next', 'next'])
  const { execa } = await import('execa')
  await execa(join(__dirname, '../node_modules/.bin/plt'), ['build'], {
    cwd: applicationPath,
  })

  const iccConfig = {
    resources: {
      threads: 1,
      heap: 256,
      services: [
        {
          name: 'next',
          threads: 3,
          heap: 200,
        },
      ],
    },
  }
  const icc = await startICC(t, { applicationId, applicationName, iccConfig })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })
  const config = await app.wattpro.runtime.getRuntimeConfig(true)

  // Check generic resources
  assert.strictEqual(config.workers, 1)
  assert.strictEqual(config.health.maxHeapTotal, 256 * Math.pow(1024, 2))

  // Check system resources
  assert.strictEqual(config.applications[0].workers, 3)
  assert.strictEqual(
    config.applications[0].health.maxHeapTotal,
    200 * Math.pow(1024, 2)
  )
})

test('should remove server https configs', async (t) => {
  const appName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-service')

  await installDeps(t, applicationPath)

  const icc = await startICC(t, {
    applicationId,
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_CONTROL_PLANE_URL: 'http://127.0.0.1:3002',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  {
    const mainConfig = app.wattpro.runtime.getRuntimeConfig(true)
    const { server } = mainConfig
    assert.strictEqual(server.https, undefined)
  }

  {
    const runtimeConfig = await app.wattpro.runtime.getRuntimeConfig(true)

    const { server } = runtimeConfig
    assert.strictEqual(server.https, undefined)
  }
})

test('should configure health options', async (t) => {
  const appName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-service')

  await installDeps(t, applicationPath)

  const icc = await startICC(t, {
    applicationId,
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const runtimeConfig = await app.wattpro.runtime.getRuntimeConfig(true)

  const { health } = runtimeConfig
  assert.strictEqual(health.enabled, true)
  assert.strictEqual(health.interval, 1000)
  assert.strictEqual(health.maxUnhealthyChecks, 30)
})

test('should call updateServicesResources with maxHeapTotal', async (t) => {
  const appName = 'test-update-resources'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-service')

  await installDeps(t, applicationPath)

  const icc = await startICC(t, {
    applicationId,
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const updateCalls = []
  const originalUpdateServicesResources =
    app.wattpro.runtime.updateServicesResources
  app.wattpro.runtime.updateServicesResources = async (resourceUpdates) => {
    updateCalls.push(resourceUpdates)
    if (originalUpdateServicesResources) {
      return originalUpdateServicesResources.call(
        app.wattpro.runtime,
        resourceUpdates
      )
    }
  }

  const config = {
    resources: {
      services: [
        { name: 'main', threads: 2, heap: 512 },
        { name: 'service-1', threads: 1, heap: 256 },
      ],
    },
  }

  await app.wattpro.applyIccConfigUpdates(config)

  assert.strictEqual(
    updateCalls.length,
    1,
    'updateServicesResources should be called once'
  )

  const resourceUpdates = updateCalls[0]
  assert.strictEqual(
    resourceUpdates.length,
    2,
    'Should have updates for 2 services'
  )

  assert.strictEqual(resourceUpdates[0].service, 'main')
  assert.strictEqual(resourceUpdates[0].workers, 2)
  assert.strictEqual(resourceUpdates[0].health.maxHeapTotal, '512MB')

  assert.strictEqual(resourceUpdates[1].service, 'service-1')
  assert.strictEqual(resourceUpdates[1].workers, 1)
  assert.strictEqual(resourceUpdates[1].health.maxHeapTotal, '256MB')
})

test('should handle updateServicesResources with different heap sizes', async (t) => {
  const appName = 'test-heap-sizes'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-service')

  await installDeps(t, applicationPath)

  const icc = await startICC(t, {
    applicationId,
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  const updateCalls = []
  app.wattpro.runtime.updateServicesResources = async (resourceUpdates) => {
    updateCalls.push(resourceUpdates)
  }

  const configs = [
    {
      resources: {
        services: [
          { name: 'small-service', threads: 1, heap: 128 },
          { name: 'large-service', threads: 4, heap: 2048 },
        ],
      },
    },
  ]

  for (const config of configs) {
    await app.wattpro.applyIccConfigUpdates(config)
  }

  assert.strictEqual(updateCalls.length, 1)

  const resourceUpdates = updateCalls[0]
  assert.strictEqual(resourceUpdates[0].health.maxHeapTotal, '128MB')
  assert.strictEqual(resourceUpdates[1].health.maxHeapTotal, '2048MB')
})

test('should handle updateServicesResources error gracefully', async (t) => {
  const appName = 'test-update-error'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-service')

  await installDeps(t, applicationPath)

  const icc = await startICC(t, {
    applicationId,
  })

  setUpEnvironment({
    PLT_APP_NAME: appName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  let errorThrown = false
  app.wattpro.runtime.updateServicesResources = async (resourceUpdates) => {
    assert.strictEqual(resourceUpdates[0].health.maxHeapTotal, '256MB')
    errorThrown = true
    throw new Error('Mock update error')
  }

  const config = {
    resources: {
      services: [{ name: 'test-service', threads: 1, heap: 256 }],
    },
  }

  await app.wattpro.applyIccConfigUpdates(config)

  assert.strictEqual(
    errorThrown,
    true,
    'updateServicesResources should have been called and thrown an error'
  )
})

test('should not set opentelemetry if it is disabled', async (t) => {
  const applicationName = 'test-application'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'service-1')

  const icc = await startICC(t, {
    applicationId,
    applicationName,
    enableOpenTelemetry: false,
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  // main config
  const { statusCode, body } = await request('http://127.0.0.1:3042/config')
  assert.strictEqual(statusCode, 200)

  const expectedTelemetry = {
    enabled: false,
    applicationName: 'test-application-main',
    skip: [
      {
        method: 'GET',
        path: '/documentation',
      },
      {
        method: 'GET',
        path: '/documentation/json',
      },
    ],
    exporter: {
      type: 'otlp',
      options: {
        url: 'http://127.0.0.1:3000/risk-service/v1/traces',
        headers: {
          'x-platformatic-application-id': applicationId,
        },
        keepAlive: true,
        httpAgentOptions: {
          rejectUnauthorized: false,
        },
      },
    },
  }
  const mainConfig = await body.json()
  assert.deepStrictEqual(mainConfig.telemetry, expectedTelemetry)
})

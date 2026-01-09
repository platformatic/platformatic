'use strict'

import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should update metrics configuration at runtime', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  // Get initial metrics to verify they are working
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('nodejs_version_info'), 'Expected initial metrics to be present')
  }

  // Update metrics configuration with new labels via runtime API
  const result = await app.updateMetricsConfig({
    enabled: true,
    labels: {
      environment: 'test'
    }
  })
  strictEqual(result.success, true)
  strictEqual(result.config.enabled, true)
  deepStrictEqual(result.config.labels, { environment: 'test' })

  // Verify metrics are still accessible after update
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('nodejs_version_info'), 'Expected metrics to still be present after update')
  }
})

test('should disable metrics at runtime', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  // Verify metrics are initially enabled
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('nodejs_version_info'), 'Expected initial metrics to be present')
  }

  // Disable metrics via runtime API
  const result = await app.updateMetricsConfig({ enabled: false })
  strictEqual(result.success, true)
  strictEqual(result.config.enabled, false)

  // Verify metrics are now disabled
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 501)
    const response = await body.json()
    strictEqual(response.error, 'Not Implemented')
  }
})

test('should re-enable metrics at runtime', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  // First disable metrics
  {
    const result = await app.updateMetricsConfig({ enabled: false })
    strictEqual(result.success, true)
  }

  // Verify metrics are disabled
  {
    const { statusCode } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 501)
  }

  // Re-enable metrics
  {
    const result = await app.updateMetricsConfig({ enabled: true })
    strictEqual(result.success, true)
    strictEqual(result.config.enabled, true)
  }

  // Verify metrics are accessible again
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('nodejs_version_info'), 'Expected metrics to be present after re-enabling')
  }
})

test('should update applicationLabel at runtime (with data loss)', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  // Get initial metrics with default applicationId label
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('applicationId='), 'Expected default applicationId label')
  }

  // Update applicationLabel to use a different label name
  const result = await app.updateMetricsConfig({
    enabled: true,
    applicationLabel: 'serviceId'
  })
  strictEqual(result.success, true)
  strictEqual(result.config.applicationLabel, 'serviceId')

  // Verify metrics use the new label name
  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/metrics'
    })
    strictEqual(statusCode, 200)
    const metrics = await body.text()
    ok(metrics.includes('nodejs_version_info'), 'Expected metrics to be present after label change')
    ok(metrics.includes('serviceId='), 'Expected new serviceId label to be present')
    ok(!metrics.includes('applicationId='), 'Expected old applicationId label to be gone')
  }
})

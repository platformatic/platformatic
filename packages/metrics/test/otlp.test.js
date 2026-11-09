import assert from 'node:assert'
import { test } from 'node:test'
import { client, collectMetrics, setupOtlpExporter } from '../index.js'

test('setupOtlpExporter returns null when no config provided', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, null, 'test-app')
  assert.strictEqual(bridge, null)
})

test('setupOtlpExporter returns null when no endpoint provided', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {}, 'test-app')
  assert.strictEqual(bridge, null)
})

test('setupOtlpExporter returns null when explicitly disabled', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    enabled: false,
    endpoint: 'http://localhost:4318/v1/metrics'
  }, 'test-app')
  assert.strictEqual(bridge, null)
})

test('setupOtlpExporter returns null when disabled via string', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    enabled: 'false',
    endpoint: 'http://localhost:4318/v1/metrics'
  }, 'test-app')
  assert.strictEqual(bridge, null)
})

test('setupOtlpExporter creates bridge with minimal config', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    endpoint: 'http://localhost:4318/v1/metrics'
  }, 'test-app')

  assert.ok(bridge, 'Bridge should be created')
  assert.strictEqual(bridge.running, false, 'Bridge should not be running initially')

  const config = bridge.config
  assert.strictEqual(config.otlpEndpoint.url, 'http://localhost:4318/v1/metrics')
  assert.strictEqual(config.interval, 60000, 'Default interval should be 60000')
  assert.strictEqual(config.conversionOptions.serviceName, 'test-app')
})

test('setupOtlpExporter creates bridge with full config', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    endpoint: 'http://collector:4318/v1/metrics',
    headers: {
      'x-api-key': 'secret123',
      'x-custom-header': 'value'
    },
    interval: 30000,
    serviceName: 'my-service',
    serviceVersion: '1.2.3'
  }, 'test-app')

  assert.ok(bridge, 'Bridge should be created')

  const config = bridge.config
  assert.strictEqual(config.otlpEndpoint.url, 'http://collector:4318/v1/metrics')
  assert.deepStrictEqual(config.otlpEndpoint.headers, {
    'x-api-key': 'secret123',
    'x-custom-header': 'value'
  })
  assert.strictEqual(config.interval, 30000)
  assert.strictEqual(config.conversionOptions.serviceName, 'my-service')
  assert.strictEqual(config.conversionOptions.serviceVersion, '1.2.3')
})

test('setupOtlpExporter uses applicationId as default serviceName', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    endpoint: 'http://localhost:4318/v1/metrics'
  }, 'my-app-id')

  assert.ok(bridge, 'Bridge should be created')
  assert.strictEqual(bridge.config.conversionOptions.serviceName, 'my-app-id')
})

test('collectMetrics returns registry and null otlpBridge', async () => {
  const result = await collectMetrics('test-service', 1, {
    defaultMetrics: false,
    httpMetrics: false
  })

  assert.ok(result.registry)
  assert.strictEqual(result.otlpBridge, null)
})

test('bridge lifecycle - start and stop', async () => {
  const registry = new client.Registry()
  const bridge = await setupOtlpExporter(registry, {
    endpoint: 'http://localhost:4318/v1/metrics',
    interval: 60000
  }, 'test-app')

  assert.ok(bridge, 'Bridge should be created')
  assert.strictEqual(bridge.running, false, 'Should not be running initially')

  // Start bridge
  bridge.start()
  assert.strictEqual(bridge.running, true, 'Should be running after start')

  // Stop bridge
  bridge.stop()
  assert.strictEqual(bridge.running, false, 'Should not be running after stop')
})

test('bridge handles errors gracefully', async () => {
  const registry = new client.Registry()

  // Add a test metric
  const counter = new client.Counter({
    name: 'test_counter',
    help: 'Test counter',
    registers: [registry]
  })
  counter.inc(5)

  const bridge = await setupOtlpExporter(registry, {
    endpoint: 'http://invalid-endpoint-that-does-not-exist:9999/v1/metrics',
    interval: 1000 // Short interval for testing
  }, 'test-app')

  assert.ok(bridge, 'Bridge should be created')

  // The bridge should not crash the app even with invalid endpoint
  // Errors are logged but don't throw
  bridge.start()
  assert.strictEqual(bridge.running, true)

  // Clean up
  bridge.stop()
  assert.strictEqual(bridge.running, false)
})

test('bridge exports the last read and never reads the registry', async t => {
  const { createServer } = await import('node:http')
  const { once } = await import('node:events')

  const bodies = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      bodies.push(Buffer.concat(chunks))
      res.end('{}')
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  // Reading the registry would run this collect callback
  const registry = new client.Registry()
  let registryReads = 0
  // eslint-disable-next-line no-new
  new client.Gauge({
    name: 'registry_gauge',
    help: 'Read only when the registry is read',
    registers: [registry],
    collect () {
      registryReads++
      this.set(1)
    }
  })

  let lastPromMetrics = null
  const bridge = await setupOtlpExporter(
    registry,
    {
      endpoint: `http://127.0.0.1:${server.address().port}/v1/metrics`,
      interval: 60000
    },
    'test-app',
    () => lastPromMetrics
  )

  lastPromMetrics = [
    {
      name: 'from_last_read',
      help: 'A metric coming from the last read',
      type: 'gauge',
      values: [{ value: 42, labels: { applicationId: 'test-app' } }],
      aggregator: 'sum'
    }
  ]

  await bridge.collectAndPush()
  assert.strictEqual(bodies.length, 1)
  assert.ok(bodies[0].includes('from_last_read'), 'the last read should be exported')
  assert.strictEqual(registryReads, 0, 'the registry must not be read')
})

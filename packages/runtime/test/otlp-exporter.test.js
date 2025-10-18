import { ok, strictEqual } from 'node:assert'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should export metrics to OTLP endpoint', async t => {
  let otlpRequestCount = 0
  let lastOtlpPayload = null

  // Create a mock OTLP server
  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      let body = Buffer.alloc(0)
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk])
      })
      req.on('end', () => {
        otlpRequestCount++
        lastOtlpPayload = body
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ partialSuccess: {} }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  const otlpPort = otlpServer.address().port

  t.after(async () => {
    otlpServer.close()
  })

  // Set environment variable for OTLP port
  process.env.PLT_OTLP_PORT = otlpPort.toString()

  const projectDir = join(fixturesDir, 'otlp-exporter')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    delete process.env.PLT_OTLP_PORT
  })

  // Wait for the runtime to start
  await sleep(1000)

  // Make some requests to generate metrics
  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl)
    strictEqual(res.statusCode, 200)
  }

  // Wait for OTLP export to happen (interval is 1000ms)
  await sleep(2500)

  // Verify that metrics were exported
  ok(otlpRequestCount > 0, 'OTLP endpoint should have received at least one request')
  ok(lastOtlpPayload !== null, 'Should have received OTLP payload')
  ok(lastOtlpPayload.length > 0, 'OTLP payload should not be empty')
})

test('should export metrics with custom headers', async t => {
  let receivedHeaders = null

  // Create a mock OTLP server that captures headers
  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      receivedHeaders = req.headers
      let body = Buffer.alloc(0)
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk])
      })
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ partialSuccess: {} }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  const otlpPort = otlpServer.address().port

  t.after(async () => {
    otlpServer.close()
  })

  // Create a custom config with headers
  const projectDir = join(fixturesDir, 'otlp-exporter')
  const configFile = join(projectDir, 'platformatic.json')

  // Read and modify config to add headers
  const fs = await import('node:fs/promises')
  const config = JSON.parse(await fs.readFile(configFile, 'utf-8'))
  config.metrics.otlpExporter.endpoint = `http://127.0.0.1:${otlpPort}/v1/metrics`
  config.metrics.otlpExporter.headers = {
    'x-api-key': 'test-key-123',
    'x-custom-header': 'custom-value'
  }

  // Write temporary config
  const tmpConfigFile = join(projectDir, 'platformatic-with-headers.json')
  await fs.writeFile(tmpConfigFile, JSON.stringify(config, null, 2))

  t.after(async () => {
    await fs.unlink(tmpConfigFile)
  })

  const app = await createRuntime(tmpConfigFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for OTLP export
  await sleep(2500)

  // Verify headers were sent
  ok(receivedHeaders !== null, 'Should have received headers')
  strictEqual(receivedHeaders['x-api-key'], 'test-key-123')
  strictEqual(receivedHeaders['x-custom-header'], 'custom-value')
})

test('should handle OTLP endpoint errors gracefully', async t => {
  let requestCount = 0

  // Create a mock OTLP server that returns errors
  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      requestCount++
      let body = Buffer.alloc(0)
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk])
      })
      req.on('end', () => {
        // Return error response
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  const otlpPort = otlpServer.address().port

  t.after(async () => {
    otlpServer.close()
  })

  process.env.PLT_OTLP_PORT = otlpPort.toString()

  const projectDir = join(fixturesDir, 'otlp-exporter')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    delete process.env.PLT_OTLP_PORT
  })

  // Wait for startup
  await sleep(1000)

  // Make requests to generate metrics
  for (let i = 0; i < 3; i++) {
    const res = await request(entryUrl)
    strictEqual(res.statusCode, 200)
  }

  // Wait for OTLP export attempts
  await sleep(2500)

  // Verify that requests were attempted despite errors
  ok(requestCount > 0, 'OTLP endpoint should have received requests despite errors')

  // The application should still be running and responsive
  const res = await request(entryUrl)
  strictEqual(res.statusCode, 200)
})

test('should export standard and custom metrics to OTLP', async t => {
  const receivedMetrics = []

  // Create a mock OTLP server that collects metrics
  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      let body = Buffer.alloc(0)
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk])
      })
      req.on('end', () => {
        receivedMetrics.push(body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ partialSuccess: {} }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  const otlpPort = otlpServer.address().port

  t.after(async () => {
    otlpServer.close()
  })

  process.env.PLT_OTLP_PORT = otlpPort.toString()

  const projectDir = join(fixturesDir, 'otlp-exporter')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    delete process.env.PLT_OTLP_PORT
  })

  // Wait for startup
  await sleep(1000)

  // Make requests to trigger custom metrics
  for (let i = 0; i < 10; i++) {
    const res = await request(entryUrl)
    strictEqual(res.statusCode, 200)
  }

  // Wait for OTLP export
  await sleep(2500)

  // Verify metrics were sent
  ok(receivedMetrics.length > 0, 'Should have received at least one OTLP export')

  // Verify the payload is binary protobuf (OTLP format)
  const firstPayload = receivedMetrics[0]
  ok(Buffer.isBuffer(firstPayload), 'Payload should be a Buffer')
  ok(firstPayload.length > 0, 'Payload should not be empty')
})

test('should not export metrics when OTLP exporter is disabled', async t => {
  let requestCount = 0

  // Create a mock OTLP server
  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      requestCount++
      res.writeHead(200)
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  const otlpPort = otlpServer.address().port

  t.after(async () => {
    otlpServer.close()
  })

  // Create config with OTLP disabled
  const projectDir = join(fixturesDir, 'otlp-exporter')
  const configFile = join(projectDir, 'platformatic.json')

  const fs = await import('node:fs/promises')
  const config = JSON.parse(await fs.readFile(configFile, 'utf-8'))
  config.metrics.otlpExporter.endpoint = `http://127.0.0.1:${otlpPort}/v1/metrics`
  config.metrics.otlpExporter.enabled = false

  const tmpConfigFile = join(projectDir, 'platformatic-disabled.json')
  await fs.writeFile(tmpConfigFile, JSON.stringify(config, null, 2))

  t.after(async () => {
    await fs.unlink(tmpConfigFile)
  })

  const app = await createRuntime(tmpConfigFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait to ensure no exports happen
  await sleep(3000)

  // Verify no requests were made
  strictEqual(requestCount, 0, 'OTLP endpoint should not have received any requests when disabled')
})

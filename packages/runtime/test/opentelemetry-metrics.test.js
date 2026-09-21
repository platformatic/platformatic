import { ok, strictEqual } from 'node:assert'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function testOpenTelemetryMetricsForwarding (t, fixture) {
  let requestCount = 0
  let lastPayload = null

  const otlpServer = createServer((req, res) => {
    if (req.url === '/v1/metrics' && req.method === 'POST') {
      let body = Buffer.alloc(0)
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk])
      })
      req.on('end', () => {
        requestCount++
        lastPayload = body
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ partialSuccess: {} }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise(resolve => otlpServer.listen(0, '127.0.0.1', resolve))
  process.env.PLT_OTLP_PORT = otlpServer.address().port.toString()

  const app = await createRuntime(join(fixturesDir, fixture, 'platformatic.json'))
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
    await new Promise(resolve => otlpServer.close(resolve))
    delete process.env.PLT_OTLP_PORT
  })

  const res = await request(entryUrl)
  strictEqual(res.statusCode, 200)

  await sleep(1500)

  ok(requestCount > 0, 'OTLP endpoint should have received at least one request')
  ok(lastPayload?.length > 0, 'OTLP payload should not be empty')
}

test('should forward user OpenTelemetry metrics to OTLP endpoint', async t => {
  await testOpenTelemetryMetricsForwarding(t, 'opentelemetry-metrics')
})

test('should forward command-based user OpenTelemetry metrics to OTLP endpoint', async t => {
  await testOpenTelemetryMetricsForwarding(t, 'opentelemetry-metrics-command')
})

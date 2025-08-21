import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'
const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('propagate the traceId correctly to runtime applications', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  const res = await request(entryUrl, {
    method: 'GET',
    path: '/',
    headers: {
      traceparent
    }
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  strictEqual(response.traceId, traceId)
})

test('attach x-plt-telemetry-id header', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const res = await request(entryUrl, {
    method: 'GET',
    path: '/service-1/echo-headers'
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()

  const echoReqHeaders = response.headers
  const telemetryIdHeader = echoReqHeaders['x-plt-telemetry-id']
  strictEqual(telemetryIdHeader, 'test-runtime-echo')
})

test('disabled telemetry', async t => {
  const configFile = join(fixturesDir, 'telemetry', 'disabled-telemetry.runtime.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  const res = await request(entryUrl, {
    method: 'GET',
    path: '/',
    headers: {
      traceparent
    }
  })

  strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  strictEqual(response.traceId, undefined)
})

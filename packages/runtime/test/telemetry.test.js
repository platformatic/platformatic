'use strict'

const assert = require('node:assert')
const { request } = require('undici')
const { test } = require('node:test')
const { join } = require('node:path')
const { createRuntime } = require('./helpers.js')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('propagate the traceId correctly to runtime services', async t => {
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

  assert.strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  assert.strictEqual(response.traceId, traceId)
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

  assert.strictEqual(res.statusCode, 200)
  const response = await res.body.json()

  const echoReqHeaders = response.headers
  const telemetryIdHeader = echoReqHeaders['x-plt-telemetry-id']
  assert.strictEqual(telemetryIdHeader, 'test-runtime-echo')
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

  assert.strictEqual(res.statusCode, 200)
  const response = await res.body.json()
  assert.strictEqual(response.traceId, undefined)
})

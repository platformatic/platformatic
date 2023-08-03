'use strict'

const assert = require('node:assert')
const { request } = require('undici')
const { test } = require('node:test')
const { join } = require('node:path')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const { startWithConfig } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('propagate the traceId correctly to runtime services', async (t) => {
  const configFile = join(fixturesDir, 'telemetry', 'platformatic.runtime.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await startWithConfig(config.configManager)

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

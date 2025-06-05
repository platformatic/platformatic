'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')
const { request } = require('undici')

test('collect the http metric', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })

  await stackable.start({ listen: true })

  await request(`${stackable.getUrl()}/foo/bar`)
  const metrics = await stackable.getMetrics({ format: 'json' })
  const httpRequestAllDurationSeconds = metrics.find((m) => m.name === 'http_request_all_duration_seconds')

  const httpRequestAllSummarySeconds = metrics.find((m) => m.name === 'http_request_all_summary_seconds', 'http_request_all_summary_seconds should have values')

  assert.ok(httpRequestAllDurationSeconds.values.length > 0)
  assert.ok(httpRequestAllSummarySeconds.values.length > 0, 'http_request_all_summary_seconds should have values')
})

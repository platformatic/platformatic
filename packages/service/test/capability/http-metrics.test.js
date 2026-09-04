import assert from 'node:assert'
import { join } from 'node:path'
import test from 'node:test'
import { request } from 'undici'
import { create } from '../../index.js'

test('do not collect http metrics by default', async t => {
  const capability = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  await request(`${capability.getUrl()}/foo/bar`)
  const metrics = await capability.getMetrics({ format: 'json' })

  const httpRequestAllDurationSeconds = metrics.find(m => m.name === 'http_request_all_duration_seconds')
  const httpRequestAllSummarySeconds = metrics.find(m => m.name === 'http_request_all_summary_seconds')

  assert.strictEqual(httpRequestAllDurationSeconds, undefined)
  assert.strictEqual(httpRequestAllSummarySeconds, undefined)
})

test('collect the http metrics when explicitly enabled', async t => {
  const capability = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'), undefined, {
    metricsConfig: { enabled: true }
  })
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  await request(`${capability.getUrl()}/foo/bar`)
  const metrics = await capability.getMetrics({ format: 'json' })

  const httpRequestAllDurationSeconds = metrics.find(m => m.name === 'http_request_all_duration_seconds')
  const httpRequestAllSummarySeconds = metrics.find(m => m.name === 'http_request_all_summary_seconds')

  assert.ok(httpRequestAllDurationSeconds.values.length > 0)
  assert.ok(httpRequestAllSummarySeconds.values.length > 0, 'http_request_all_summary_seconds should have values')
})

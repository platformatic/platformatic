import assert from 'node:assert'
import { join } from 'node:path'
import test from 'node:test'
import { request } from 'undici'
import { create } from '../../index.js'

test('collect the http metrics', async t => {
  const stackable = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  await request(`${stackable.getUrl()}/foo/bar`)
  const metrics = await stackable.getMetrics({ format: 'json' })

  const httpRequestAllDurationSeconds = metrics.find(m => m.name === 'http_request_all_duration_seconds')
  const httpRequestAllSummarySeconds = metrics.find(
    m => m.name === 'http_request_all_summary_seconds',
    'http_request_all_summary_seconds should have values'
  )

  assert.ok(httpRequestAllDurationSeconds.values.length > 0)
  assert.ok(httpRequestAllSummarySeconds.values.length > 0, 'http_request_all_summary_seconds should have values')
})

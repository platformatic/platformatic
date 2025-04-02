import { test } from 'node:test'
import assert from 'node:assert'
import { resolve } from 'node:path'
import { request } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('metrics', async t => {
  const { url } = await createRuntime(t, 'standalone')

  await request(url + '/')
  // const res = 
  // const text = await res.body.text()
  // assert.strictEqual(res.statusCode, 200)

  const { body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics'
  })

  const metrics = await body.text()
  console.log(metrics)

  assert.ok(metrics.includes('# HELP http_request_summary_seconds '))
  assert.ok(metrics.includes('# TYPE http_request_summary_seconds summary'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.01",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.05",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.5",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.9",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.95",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.99",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds{quantile="0.999",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds_sum{method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_summary_seconds_count{method="GET",status_code="200"'))

  assert.ok(metrics.includes('# HELP http_request_duration_seconds '))
  assert.ok(metrics.includes('# TYPE http_request_duration_seconds histogram'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.005",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.01",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.025",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.05",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.1",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.25",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.5",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="1",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="2.5",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="5",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="10",serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_sum{serviceId="frontend",method="GET",status_code="200"'))
  assert.ok(metrics.includes('http_request_duration_seconds_count{serviceId="frontend",method="GET",status_code="200"'))

})

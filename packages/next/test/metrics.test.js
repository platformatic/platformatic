import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, LOGS_TIMEOUT, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should configure metrics correctly with both node and http metrics', async t => {
  const configuration = 'standalone-with-metrics'

  const { url } = await createRuntime(t, configuration)

  // This is needed for the diagnostics channel to start intercepting requests
  await sleep(LOGS_TIMEOUT)

  {
    // Test request to add http metrics
    const { statusCode } = await request(url, {
      method: 'GET',
      path: '/'
    })
    assert.strictEqual(statusCode, 200)
  }

  const { body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics'
  })

  const metrics = await body.text()

  const metricsNames = metrics
    .split('\n')
    .filter(line => line && line.startsWith('# TYPE'))
    .map(line => line.split(' ')[2])

  const expectedMetricNames = [
    'nodejs_active_handles',
    'nodejs_active_handles_total',
    'nodejs_active_requests',
    'nodejs_active_requests_total',
    'nodejs_active_resources',
    'nodejs_active_resources_total',
    'nodejs_eventloop_lag_max_seconds',
    'nodejs_eventloop_lag_mean_seconds',
    'nodejs_eventloop_lag_min_seconds',
    'nodejs_eventloop_lag_p50_seconds',
    'nodejs_eventloop_lag_p90_seconds',
    'nodejs_eventloop_lag_p99_seconds',
    'nodejs_eventloop_lag_seconds',
    'nodejs_eventloop_lag_stddev_seconds',
    'nodejs_eventloop_utilization',
    'nodejs_external_memory_bytes',
    'nodejs_gc_duration_seconds',
    'nodejs_heap_size_total_bytes',
    'nodejs_heap_size_used_bytes',
    'nodejs_heap_space_size_available_bytes',
    'nodejs_heap_space_size_total_bytes',
    'nodejs_heap_space_size_used_bytes',
    'nodejs_version_info',
    'process_cpu_percent_usage',
    'process_cpu_seconds_total',
    'process_cpu_system_seconds_total',
    'process_cpu_user_seconds_total',
    'process_resident_memory_bytes',
    'process_start_time_seconds',
    'http_request_all_summary_seconds',
    'http_request_all_duration_seconds'
  ]
  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName), `should include metric ${metricName}`)
  }

  const entrypointRequestCountMetric = metrics
    .split('\n')
    .find(line => line.includes('http_request_all_summary_seconds_count') && line.includes('applicationId="frontend"'))
  if (!entrypointRequestCountMetric) {
    assert.fail('Expected entrypoint request count metric not found')
  }
  const entrypointRequestCount = entrypointRequestCountMetric.split(' ')[1]
  assert.strictEqual(entrypointRequestCount, '1')
})

import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import assert from 'node:assert'

import {
  createRuntime,
  fixturesDir,
  setFixturesDir,
} from '../../basic/test/helper.js'

import { safeRemove } from '../../utils/index.js'

process.setMaxListeners(100)

const packageRoot = resolve(import.meta.dirname, '..')

// Make sure no temporary files exist after execution
test.afterEach(() => {
  if (fixturesDir) {
    return Promise.all([
      safeRemove(resolve(fixturesDir, 'node_modules')),
    ])
  }
})

test('should configure metrics correctly with both node and http metrics', async t => {
  const configuration = 'express-api-metrics'

  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))
  await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  // Test request to add http metrics
  await request('http://127.0.0.1:3042', {
    method: 'GET',
    path: '/internal',
  })

  const { body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics',
  })

  const metrics = await body.text()
  const metricsNames = metrics.split('\n')
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
    'http_request_all_duration_seconds',
    'http_request_duration_seconds',
    'http_request_summary_seconds',
  ]
  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName))
  }

  const entrypointRequestCountMetric = metrics.split('\n').find(
    line =>
      line.includes('http_request_summary_seconds_count') &&
      line.includes('serviceId="api"')
  )
  if (!entrypointRequestCountMetric) {
    assert.fail('Expected entrypoint request count metric not found')
  }
  const entrypointRequestCount = entrypointRequestCountMetric.split(' ')[1]
  assert.strictEqual(entrypointRequestCount, '1')

  const internalRequestCountMetric = metrics.split('\n').find(
    line =>
      line.includes('http_request_summary_seconds_count') &&
      line.includes('serviceId="internal"')
  )
  if (!internalRequestCountMetric) {
    assert.fail('Expected internal request count metric not found')
  }
  const internalRequestCount = internalRequestCountMetric.split(' ')[1]
  assert.strictEqual(internalRequestCount, '1')
})

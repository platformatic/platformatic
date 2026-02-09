import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, LOGS_TIMEOUT, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should configure metrics correctly with both node and http metrics', { skip: true }, async t => {
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

async function waitForMetrics (port, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { statusCode, body } = await request(`http://127.0.0.1:${port}/metrics`)
      const text = await body.text()
      return { statusCode, metrics: text }
    } catch (e) {
      if (i < maxRetries - 1) {
        await sleep(200)
      }
    }
  }
  throw new Error(`Failed to connect to metrics server on port ${port} after ${maxRetries} retries`)
}

test('should update metrics config at runtime', async t => {
  const initialPort = 9090
  const newPort = 9091
  const { runtime } = await createRuntime(t, 'standalone-with-metrics')

  await runtime.getRuntimeConfig()

  // Verify initial metrics are available on default port
  {
    const { statusCode, metrics } = await waitForMetrics(initialPort)
    assert.strictEqual(statusCode, 200)
    assert.ok(metrics.includes('nodejs_version_info') || metrics.includes('http_cache'), 'Expected initial metrics to be present')
  }

  // Change the metrics port
  const portChangeResult = await runtime.updateMetricsConfig({ enabled: true, port: newPort })
  assert.strictEqual(portChangeResult.success, true)
  assert.strictEqual(portChangeResult.config.port, newPort)

  // Verify old port is closed
  try {
    await request(`http://127.0.0.1:${initialPort}/metrics`)
    throw new Error('Expected old port to be closed')
  } catch (e) {
    assert.strictEqual(e.code, 'ECONNREFUSED', 'Expected old port to be closed')
  }

  // Verify metrics are available on new port
  {
    const { statusCode, metrics } = await waitForMetrics(newPort)
    assert.strictEqual(statusCode, 200)
    assert.ok(metrics.includes('nodejs_version_info') || metrics.includes('http_cache'), 'Expected metrics on new port')
  }

  // Disable metrics
  const disableResult = await runtime.updateMetricsConfig({ enabled: false })
  assert.strictEqual(disableResult.success, true)
  assert.strictEqual(disableResult.config.enabled, false)

  // Verify metrics server is closed when disabled
  try {
    await request(`http://127.0.0.1:${newPort}/metrics`)
    throw new Error('Expected request to fail when disabled')
  } catch (e) {
    assert.strictEqual(e.code, 'ECONNREFUSED', 'Expected ECONNREFUSED when metrics disabled')
  }

  // Re-enable metrics
  const enableResult = await runtime.updateMetricsConfig({ enabled: true, port: newPort })
  assert.strictEqual(enableResult.success, true)
  assert.strictEqual(enableResult.config.enabled, true)

  // Verify metrics are available again
  {
    const { statusCode, metrics } = await waitForMetrics(newPort)
    assert.strictEqual(statusCode, 200)
    assert.ok(metrics.includes('nodejs_version_info') || metrics.includes('http_cache'), 'Expected metrics to be re-enabled')
  }
})

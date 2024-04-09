'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime metrics in a json format', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()
  const metricsNames = metrics.map((metric) => metric.name)

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
    'service_1_http_request_all_summary_seconds',
    'service_1_http_request_duration_seconds',
    'service_1_http_request_summary_seconds',
    'service_2_http_request_all_summary_seconds',
    'service_2_http_request_duration_seconds',
    'service_2_http_request_summary_seconds'
  ]
  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName))
  }
})

test('should get runtime metrics in a text format', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const metrics = await app.getMetrics('text')
  const metricsNames = metrics.metrics.split('\n')
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
    'service_1_http_request_all_summary_seconds',
    'service_1_http_request_duration_seconds',
    'service_1_http_request_summary_seconds',
    'service_2_http_request_all_summary_seconds',
    'service_2_http_request_duration_seconds',
    'service_2_http_request_summary_seconds'
  ]
  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName))
  }
})

test('should get formatted runtime metrics', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const metrics = await app.getFormattedMetrics()
  const metricsKeys = Object.keys(metrics).sort()

  assert.deepStrictEqual(metricsKeys, [
    'cpu',
    'date',
    'elu',
    'entrypoint',
    'newSpaceSize',
    'oldSpaceSize',
    'rss',
    'totalHeapSize',
    'usedHeapSize',
    'version'
  ])

  const entrypointMetrics = metrics.entrypoint
  const entrypointMetricsKeys = Object.keys(entrypointMetrics).sort()
  assert.deepStrictEqual(entrypointMetricsKeys, ['latency'])

  const latencyMetrics = entrypointMetrics.latency
  const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
  assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
})

test('should get cached formatted runtime metrics', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // wait for the metrics to be cached
  await sleep(5000)

  const metrics = await app.getCachedMetrics()

  for (const metric of metrics) {
    const metricsKeys = Object.keys(metric).sort()
    assert.deepStrictEqual(metricsKeys, [
      'cpu',
      'date',
      'elu',
      'entrypoint',
      'newSpaceSize',
      'oldSpaceSize',
      'rss',
      'totalHeapSize',
      'usedHeapSize',
      'version'
    ])

    const entrypointMetrics = metric.entrypoint
    const entrypointMetricsKeys = Object.keys(entrypointMetrics).sort()
    assert.deepStrictEqual(entrypointMetricsKeys, ['latency'])

    const latencyMetrics = entrypointMetrics.latency
    const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
    assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
  }
})

test('should get metrics after reloading one of the services', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopService('service-2')
  await app.startService('service-2')

  await sleep(5000)

  const metrics = await app.getCachedMetrics()

  for (const metric of metrics) {
    const metricsKeys = Object.keys(metric).sort()
    assert.deepStrictEqual(metricsKeys, [
      'cpu',
      'date',
      'elu',
      'entrypoint',
      'newSpaceSize',
      'oldSpaceSize',
      'rss',
      'totalHeapSize',
      'usedHeapSize',
      'version'
    ])

    const entrypointMetrics = metric.entrypoint
    const entrypointMetricsKeys = Object.keys(entrypointMetrics).sort()
    assert.deepStrictEqual(entrypointMetricsKeys, ['latency'])

    const latencyMetrics = entrypointMetrics.latency
    const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
    assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
  }
})

'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { request } = require('undici')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

function findPrometheusLinesForMetric (metric, output) {
  const ret = []
  const lines = output.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith(metric)) {
      ret.push(line)
    }
  }
  return ret
}

test('should get runtime metrics in a json format', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  await Promise.all([
    app.inject('service-1', {
      method: 'GET',
      url: '/hello',
      headers: { 'x-plt-telemetry-id': 'service-1-client' }
    }),
    app.inject('service-2', {
      method: 'GET',
      url: '/service-2/hello',
      headers: { 'x-plt-telemetry-id': 'service-2-client' }
    })
  ])

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()

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
    'http_client_stats_free',
    'http_client_stats_connected',
    'http_client_stats_pending',
    'http_client_stats_queued',
    'http_client_stats_running',
    'http_client_stats_size'
  ]

  const services = ['service-1', 'service-2', 'service-db']

  for (const metricName of expectedMetricNames) {
    const foundMetrics = metrics.filter(m => m.name === metricName)
    assert.ok(foundMetrics.length > 0, `Missing metric: ${metricName}`)
    assert.strictEqual(foundMetrics.length, services.length)

    const hasValues = foundMetrics.every(m => m.values.length > 0)
    if (!hasValues) continue

    for (const serviceId of services) {
      const foundMetric = foundMetrics.find(m => m.values[0].labels.serviceId === serviceId)
      assert.ok(foundMetric, `Missing metric for service "${serviceId}"`)

      for (const { labels } of foundMetric.values) {
        if (labels.route === '/__empty_metrics') {
          continue
        }

        assert.strictEqual(labels.serviceId, serviceId)
        assert.strictEqual(labels.custom_label, 'custom-value')

        if (metricName.startsWith('http_request')) {
          assert.strictEqual(labels.telemetry_id, `${serviceId}-client`)
        }
      }
    }
  }
})

test('should get runtime metrics in a text format', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const url = await app.start()
  // We call service-1 and service-2 (this one indirectly through the entrypoint), so we expect metrics from both
  await request(url + '/hello')
  await request(url + '/service-2/hello')

  t.after(async () => {
    await app.close()
  })

  const metrics = await app.getMetrics('text')
  const metricsNames = metrics.metrics
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
    'http_client_stats_free',
    'http_client_stats_connected',
    'http_client_stats_pending',
    'http_client_stats_queued',
    'http_client_stats_running',
    'http_client_stats_size'
  ]
  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName), `Missing metric: ${metricName}`)
  }

  // Check that the serviceId labels are present in the metrics
  const httpRequestsSummary = findPrometheusLinesForMetric('http_request_all_summary_seconds', metrics.metrics)
  const httpRequestsSummaryLabels = httpRequestsSummary.map(line => line.split('{')[1].split('}')[0].split(','))
  const services = httpRequestsSummaryLabels
    .flat()
    .filter(label => label.startsWith('serviceId='))
    .reduce((acc, label) => {
      const service = label.split('"')[1]
      if (service) {
        acc.push(service)
      }
      return acc
    }, [])

  const serviceIds = [...new Set(services)].sort()

  // We call service-1 and service-2, so we expect metrcis for these
  assert.deepEqual(serviceIds, ['service-1', 'service-2'])
})

function getMetricsLines (metrics) {
  return metrics.split('\n').filter(line => line && !line.startsWith('#'))
}

function parseLabels (line) {
  return line
    .split('{')[1]
    .split('}')[0]
    .split(',')
    .reduce((acc, label) => {
      const [key, value] = label.split('=')
      acc[key] = value.replace(/^"(.*)"$/, '$1')
      return acc
    }, {})
}

test('should get runtime metrics in a text format with custom labels', async t => {
  const projectDir = join(fixturesDir, 'management-api-custom-labels')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const metrics = await app.getMetrics('text')
  const labels = getMetricsLines(metrics.metrics).map(parseLabels)

  // Ensure that the custom labels are present in the metrics
  for (const lineLabel of labels) {
    assert.ok(lineLabel.foo === 'bar')
  }
})

test('should get json runtime metrics with custom labels', async t => {
  const projectDir = join(fixturesDir, 'management-api-custom-labels')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()

  for (const metric of metrics) {
    for (const value of metric.values) {
      assert.ok(value.labels.foo === 'bar')
    }
  }
})

test('should get formatted runtime metrics', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { services } = await app.getFormattedMetrics()

  assert.deepStrictEqual(Object.keys(services).sort(), ['service-1', 'service-2', 'service-db'].sort())

  for (const serviceMetrics of Object.values(services)) {
    assert.deepStrictEqual(
      Object.keys(serviceMetrics).sort(),
      ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
    )

    const latencyMetrics = serviceMetrics.latency
    const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
    assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
  }
})

test('should get cached formatted runtime metrics', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const appUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  for (let i = 0; i < 10; i++) {
    const { statusCode } = await request(appUrl + '/hello')
    assert.strictEqual(statusCode, 200)
  }

  // wait for the metrics to be cached
  await sleep(5000)

  const metricsHistory = await app.getCachedMetrics()

  for (const { services } of metricsHistory) {
    assert.deepStrictEqual(Object.keys(services).sort(), ['service-1', 'service-2', 'service-db'].sort())

    for (const serviceMetrics of Object.values(services)) {
      assert.deepStrictEqual(
        Object.keys(serviceMetrics).sort(),
        ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
      )

      const latencyMetrics = serviceMetrics.latency
      const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
      assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
    }
  }
})

test('should get metrics after reloading one of the services', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopService('service-2')
  await app.startService('service-2')

  await sleep(5000)

  const metricsHistory = await app.getCachedMetrics()

  for (const { services } of metricsHistory) {
    const servicesNames = Object.keys(services)
    assert.ok(servicesNames.includes('service-1'))
    assert.ok(servicesNames.includes('service-db'))

    for (const serviceMetrics of Object.values(services)) {
      assert.deepStrictEqual(
        Object.keys(serviceMetrics).sort(),
        ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
      )

      const latencyMetrics = serviceMetrics.latency
      const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
      assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
    }
  }
})

test('should get runtime metrics in a json format without a service call', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const url = await app.start()
  // We call service-1 and service-2 (this one indirectly through the entrypoint), so we expect metrics from both
  await request(url + '/hello')
  await request(url + '/service-2/hello')

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()

  const histogramMetric = metrics.find(metric => metric.name === 'http_request_all_duration_seconds')

  const histogramValues = histogramMetric.values

  {
    const histogramCount = histogramValues.find(
      ({ metricName }) => metricName === 'http_request_all_duration_seconds_count'
    )
    assert.strictEqual(histogramCount.value, 2)
  }

  {
    const histogramSum = histogramValues.find(
      ({ metricName }) => metricName === 'http_request_all_duration_seconds_sum'
    )
    const value = histogramSum.value
    assert.ok(value < 0.1)
  }

  for (const { metricName, labels } of histogramValues) {
    assert.strictEqual(labels.method, 'GET')
    assert.strictEqual(labels.status_code, 200)

    if (metricName !== 'http_request_all_duration_seconds_bucket') continue
  }

  const summaryMetric = metrics.find(metric => metric.name === 'http_request_all_summary_seconds')
  assert.strictEqual(summaryMetric.name, 'http_request_all_summary_seconds')
  assert.strictEqual(summaryMetric.type, 'summary')
  assert.strictEqual(summaryMetric.aggregator, 'sum')

  const freeMetric = metrics.find(({ name }) => name === 'http_client_stats_free')
  assert.strictEqual(freeMetric.name, 'http_client_stats_free')
  assert.strictEqual(freeMetric.type, 'gauge')
  assert.strictEqual(freeMetric.aggregator, 'sum')

  const connectedMetric = metrics.find(({ name }) => name === 'http_client_stats_connected')
  assert.strictEqual(connectedMetric.name, 'http_client_stats_connected')
  assert.strictEqual(connectedMetric.type, 'gauge')
  assert.strictEqual(connectedMetric.aggregator, 'sum')

  const pendingMetric = metrics.find(({ name }) => name === 'http_client_stats_pending')
  assert.strictEqual(pendingMetric.name, 'http_client_stats_pending')
  assert.strictEqual(pendingMetric.type, 'gauge')
  assert.strictEqual(pendingMetric.aggregator, 'sum')

  const queuedMetric = metrics.find(({ name }) => name === 'http_client_stats_queued')
  assert.strictEqual(queuedMetric.name, 'http_client_stats_queued')
  assert.strictEqual(queuedMetric.type, 'gauge')
  assert.strictEqual(queuedMetric.aggregator, 'sum')

  const runningMetric = metrics.find(({ name }) => name === 'http_client_stats_running')
  assert.strictEqual(runningMetric.name, 'http_client_stats_running')
  assert.strictEqual(runningMetric.type, 'gauge')
  assert.strictEqual(runningMetric.aggregator, 'sum')

  const sizeMetric = metrics.find(({ name }) => name === 'http_client_stats_size')
  assert.strictEqual(sizeMetric.name, 'http_client_stats_size')
  assert.strictEqual(sizeMetric.type, 'gauge')
  assert.strictEqual(sizeMetric.aggregator, 'sum')

  const summaryValues = summaryMetric.values

  {
    const summaryCount = summaryValues.find(({ metricName }) => metricName === 'http_request_all_summary_seconds_count')
    assert.strictEqual(summaryCount.value, 2)
  }

  {
    const summarySum = summaryValues.find(({ metricName }) => metricName === 'http_request_all_summary_seconds_sum')
    const value = summarySum.value
    assert.ok(value < 0.1)
  }
})

import { deepEqual, deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

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
      url: '/hello'
    }),
    app.inject('service-2', {
      method: 'GET',
      url: '/service-2/hello'
    })
  ])

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()

  const perApplicationMetricNames = [
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
    'http_request_all_summary_seconds',
    'http_client_request_duration_seconds',
    'http_client_stats_free',
    'http_client_stats_connected',
    'http_client_stats_pending',
    'http_client_stats_queued',
    'http_client_stats_running',
    'http_client_stats_size',
    'active_resources_event_loop',
    'platformatic_application_restarts_total'
  ]

  // These describe the whole runtime process and are reported only once,
  // without application labels. See issue #3332.
  const processLevelMetricNames = [
    'nodejs_version_info',
    'process_cpu_percent_usage',
    'process_cpu_seconds_total',
    'process_cpu_system_seconds_total',
    'process_cpu_user_seconds_total',
    'process_resident_memory_bytes',
    'process_start_time_seconds'
  ]

  const applications = ['service-1', 'service-2', 'service-db']

  for (const metricName of perApplicationMetricNames) {
    const foundMetrics = metrics.filter(m => m.name === metricName)
    ok(foundMetrics.length > 0, `Missing metric: ${metricName}`)
    strictEqual(foundMetrics.length, applications.length)

    const hasValues = foundMetrics.every(m => m.values.length > 0)
    if (!hasValues) continue

    for (const applicationId of applications) {
      const foundMetric = foundMetrics.find(m => m.values[0].labels.applicationId === applicationId)
      ok(foundMetric, `Missing metric for application "${applicationId}"`)

      for (const { labels } of foundMetric.values) {
        if (labels.route === '/__empty_metrics') {
          continue
        }

        strictEqual(labels.applicationId, applicationId)
        strictEqual(labels.custom_label, 'custom-value')
      }
    }
  }

  for (const metricName of processLevelMetricNames) {
    const foundMetrics = metrics.filter(m => m.name === metricName)
    strictEqual(foundMetrics.length, 1, `Expected metric ${metricName} to be reported only once`)

    for (const { labels } of foundMetrics[0].values) {
      strictEqual(labels.applicationId, undefined, `Expected metric ${metricName} to have no applicationId label`)
      strictEqual(labels.workerId, undefined, `Expected metric ${metricName} to have no workerId label`)
      strictEqual(labels.custom_label, 'custom-value')
    }
  }
})

test('should track application restarts in runtime metrics', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.restartApplication('service-2')
  await app.restartApplication('service-2')

  const { metrics } = await app.getMetrics()
  const restartMetrics = metrics.filter(metric => metric.name === 'platformatic_application_restarts_total')

  strictEqual(restartMetrics.length, 3)
  strictEqual(restartMetrics[0].type, 'counter')
  strictEqual(restartMetrics[0].aggregator, 'sum')

  const restartCounts = Object.fromEntries(
    restartMetrics.map(({ values }) => {
      const [{ labels, value }] = values
      return [labels.applicationId, value]
    })
  )

  deepStrictEqual(restartCounts, {
    'service-1': 0,
    'service-2': 2,
    'service-db': 0
  })
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
    'http_client_request_duration_seconds',
    'http_client_stats_free',
    'http_client_stats_connected',
    'http_client_stats_pending',
    'http_client_stats_queued',
    'http_client_stats_running',
    'http_client_stats_size',
    'active_resources_event_loop',
    'platformatic_application_restarts_total'
  ]
  for (const metricName of expectedMetricNames) {
    ok(metricsNames.includes(metricName), `Missing metric: ${metricName}`)
  }

  // Check that the applicationId labels are present in the metrics
  const httpRequestsSummary = findPrometheusLinesForMetric('http_request_all_summary_seconds', metrics.metrics)
  const httpRequestsSummaryLabels = httpRequestsSummary.map(line => line.split('{')[1].split('}')[0].split(','))
  const applications = httpRequestsSummaryLabels
    .flat()
    .filter(label => label.startsWith('applicationId='))
    .reduce((acc, label) => {
      const application = label.split('"')[1]
      if (application) {
        acc.push(application)
      }
      return acc
    }, [])

  const applicationIds = [...new Set(applications)].sort()

  // We call service-1 and service-2, so we expect metrcis for these
  deepEqual(applicationIds, ['service-1', 'service-2'])

  // Process-level metrics describe the whole runtime process, so they must be
  // reported only once and without application labels. See issue #3332.
  const rssLines = findPrometheusLinesForMetric('process_resident_memory_bytes', metrics.metrics)
  strictEqual(rssLines.length, 1, 'Expected process_resident_memory_bytes to be reported only once')
  ok(!rssLines[0].includes('applicationId='), 'Expected process_resident_memory_bytes to have no applicationId label')
  ok(!rssLines[0].includes('workerId='), 'Expected process_resident_memory_bytes to have no workerId label')
})

test('should report process-level metrics for applications running as separate processes', async t => {
  const projectDir = join(fixturesDir, 'metrics-command')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { metrics } = await app.getMetrics()

  const rssMetrics = metrics.filter(m => m.name === 'process_resident_memory_bytes')

  // The runtime process reports its own RSS once, without application labels ...
  const runtimeRss = rssMetrics.filter(m => m.values.every(v => v.labels.applicationId === undefined))
  strictEqual(runtimeRss.length, 1, 'Expected a single runtime-wide process_resident_memory_bytes metric')
  ok(runtimeRss[0].values[0].value > 0)

  // ... while the application running as a separate OS process reports its own RSS,
  // with its own labels. See issue #3332.
  const applicationRss = rssMetrics.filter(m => m.values.every(v => v.labels.applicationId === 'main'))
  strictEqual(applicationRss.length, 1, 'Expected a process_resident_memory_bytes metric for the "main" application')
  ok(applicationRss[0].values[0].value > 0)

  strictEqual(rssMetrics.length, 2)
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
    ok(lineLabel.foo === 'bar')
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
      ok(value.labels.foo === 'bar')
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

  const { applications } = await app.getFormattedMetrics()

  deepStrictEqual(Object.keys(applications).sort(), ['service-1', 'service-2', 'service-db'].sort())

  for (const applicationMetrics of Object.values(applications)) {
    deepStrictEqual(
      Object.keys(applicationMetrics).sort(),
      ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
    )

    const latencyMetrics = applicationMetrics.latency
    const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
    deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
  }
})

test('should get formatted runtime metrics multiple times', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  const appUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  for (let i = 0; i < 10; i++) {
    const { statusCode } = await request(appUrl + '/hello')
    strictEqual(statusCode, 200)
  }

  // wait for the metrics to be collected
  await sleep(2000)

  // Collect metrics multiple times to ensure polling works
  for (let i = 0; i < 3; i++) {
    const { applications } = await app.getFormattedMetrics()

    deepStrictEqual(Object.keys(applications).sort(), ['service-1', 'service-2', 'service-db'].sort())

    for (const applicationMetrics of Object.values(applications)) {
      deepStrictEqual(
        Object.keys(applicationMetrics).sort(),
        ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
      )

      const latencyMetrics = applicationMetrics.latency
      const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
      deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
    }

    if (i < 2) {
      await sleep(1000)
    }
  }
})

test('should get metrics after reloading one of the applications', async t => {
  const projectDir = join(fixturesDir, 'metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopApplication('service-2')
  await app.startApplication('service-2')

  await sleep(2000)

  // Collect metrics multiple times after reloading
  for (let i = 0; i < 3; i++) {
    const { applications } = await app.getFormattedMetrics()
    const applicationsNames = Object.keys(applications)
    ok(applicationsNames.includes('service-1'))
    ok(applicationsNames.includes('service-db'))

    for (const applicationMetrics of Object.values(applications)) {
      deepStrictEqual(
        Object.keys(applicationMetrics).sort(),
        ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
      )

      const latencyMetrics = applicationMetrics.latency
      const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
      deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
    }

    if (i < 2) {
      await sleep(1000)
    }
  }
})

test('should get runtime metrics in a json format without a application call', async t => {
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
    strictEqual(histogramCount.value, 2)
  }

  {
    const histogramSum = histogramValues.find(
      ({ metricName }) => metricName === 'http_request_all_duration_seconds_sum'
    )
    const value = histogramSum.value
    ok(value < 0.1)
  }

  for (const { metricName, labels } of histogramValues) {
    strictEqual(labels.method, 'GET')
    strictEqual(labels.status_code, 200)

    if (metricName !== 'http_request_all_duration_seconds_bucket') continue
  }

  const summaryMetric = metrics.find(metric => metric.name === 'http_request_all_summary_seconds')
  strictEqual(summaryMetric.name, 'http_request_all_summary_seconds')
  strictEqual(summaryMetric.type, 'summary')
  strictEqual(summaryMetric.aggregator, 'sum')

  const clientDurationMetric = metrics.find(({ name }) => name === 'http_client_request_duration_seconds')
  strictEqual(clientDurationMetric.name, 'http_client_request_duration_seconds')
  strictEqual(clientDurationMetric.type, 'histogram')
  strictEqual(clientDurationMetric.aggregator, 'sum')

  const freeMetric = metrics.find(({ name }) => name === 'http_client_stats_free')
  strictEqual(freeMetric.name, 'http_client_stats_free')
  strictEqual(freeMetric.type, 'gauge')
  strictEqual(freeMetric.aggregator, 'sum')

  const connectedMetric = metrics.find(({ name }) => name === 'http_client_stats_connected')
  strictEqual(connectedMetric.name, 'http_client_stats_connected')
  strictEqual(connectedMetric.type, 'gauge')
  strictEqual(connectedMetric.aggregator, 'sum')

  const pendingMetric = metrics.find(({ name }) => name === 'http_client_stats_pending')
  strictEqual(pendingMetric.name, 'http_client_stats_pending')
  strictEqual(pendingMetric.type, 'gauge')
  strictEqual(pendingMetric.aggregator, 'sum')

  const queuedMetric = metrics.find(({ name }) => name === 'http_client_stats_queued')
  strictEqual(queuedMetric.name, 'http_client_stats_queued')
  strictEqual(queuedMetric.type, 'gauge')
  strictEqual(queuedMetric.aggregator, 'sum')

  const runningMetric = metrics.find(({ name }) => name === 'http_client_stats_running')
  strictEqual(runningMetric.name, 'http_client_stats_running')
  strictEqual(runningMetric.type, 'gauge')
  strictEqual(runningMetric.aggregator, 'sum')

  const sizeMetric = metrics.find(({ name }) => name === 'http_client_stats_size')
  strictEqual(sizeMetric.name, 'http_client_stats_size')
  strictEqual(sizeMetric.type, 'gauge')
  strictEqual(sizeMetric.aggregator, 'sum')

  const activeMetric = metrics.find(({ name }) => name === 'active_resources_event_loop')
  strictEqual(activeMetric.type, 'gauge')
  strictEqual(activeMetric.aggregator, 'sum')
  const [
    {
      labels: { applicationId, custom_label: label },
      value
    }
  ] = activeMetric.values
  strictEqual(applicationId, 'service-1')
  strictEqual(label, 'custom-value')
  ok(value > 0)

  const summaryValues = summaryMetric.values

  {
    const summaryCount = summaryValues.find(({ metricName }) => metricName === 'http_request_all_summary_seconds_count')
    strictEqual(summaryCount.value, 2)
  }

  {
    const summarySum = summaryValues.find(({ metricName }) => metricName === 'http_request_all_summary_seconds_sum')
    const value = summarySum.value
    ok(value < 0.1)
  }
})

test('should get metrics when an application registered http stats globals without fields tracking', async t => {
  const projectDir = join(fixturesDir, 'metrics-legacy-globals')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.inject('service-1', {
    method: 'GET',
    url: '/hello'
  })

  await app.inject('service-1', {
    method: 'GET',
    url: '/simulate-legacy-globals'
  })

  const { metrics } = await app.getMetrics()

  const metricsNames = metrics.map(({ name }) => name)
  ok(metricsNames.includes('http_request_all_summary_seconds'))
})

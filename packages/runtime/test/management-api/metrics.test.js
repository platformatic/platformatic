import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

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
  'thread_cpu_user_system_seconds_total',
  'thread_cpu_system_seconds_total',
  'thread_cpu_seconds_total',
  'thread_cpu_percent_usage',
  'http_request_all_duration_seconds',
  'http_request_all_summary_seconds',
  'http_client_stats_free',
  'http_client_stats_connected',
  'http_client_stats_pending',
  'http_client_stats_queued',
  'http_client_stats_running',
  'http_client_stats_size',
  'active_resources_event_loop'
]

test('should get prom metrics from the management api', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metrics'
  })
  strictEqual(statusCode, 200)

  const metrics = await body.text()
  const metricsNames = metrics
    .split('\n')
    .filter(line => line && line.startsWith('# TYPE'))
    .map(line => line.split(' ')[2])

  for (const metricName of expectedMetricNames) {
    ok(metricsNames.includes(metricName), `Expected metric ${metricName} to be present`)
  }
})

test('should get prom metrics from the management api in the json format', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metrics',
    headers: {
      Accept: 'application/json'
    }
  })
  strictEqual(statusCode, 200)

  const metrics = await body.json()
  const metricsNames = metrics.map(metric => metric.name)

  for (const metricName of expectedMetricNames) {
    ok(metricsNames.includes(metricName), `Expected metric ${metricName} to be present`)
  }
})

test('should only receive an error message if the metrics are disabled', async t => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metrics',
    headers: {
      Accept: 'application/json'
    }
  })
  strictEqual(statusCode, 501)

  const metrics = await body.json()
  deepStrictEqual(metrics, { statusCode: 501, error: 'Not Implemented', message: 'Metrics are disabled.' })
})

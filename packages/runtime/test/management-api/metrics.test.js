import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { kITC } from '../../lib/worker/symbols.js'
import { configurationFileIn, createRuntime } from '../helpers.js'

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

async function createMetricsRuntime (t, metrics) {
  const app = await createRuntime(join(fixturesDir, 'prom-server', 'default'), {
    watch: false,
    autoload: { path: '../services' },
    workers: 1,
    metrics
  })
  t.after(() => app.close())
  await app.start()

  const client = new Client('http://localhost', {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
  t.after(() => client.close())
  return { app, client }
}

test('should get prom metrics from the management api', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'default', 'watt.config.mjs')
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
  const configFile = join(projectDir, 'default', 'watt.config.mjs')
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
  const configFile = configurationFileIn(projectDir)
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
  deepStrictEqual(metrics, {
    statusCode: 501,
    code: 'PLT_RUNTIME_METRICS_DISABLED',
    error: 'Not Implemented',
    message: 'Metrics are disabled.'
  })
})

test('should disable metrics when no metrics configuration is provided', async t => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics-omitted')
  const app = await createRuntime(projectDir)

  await app.start()

  const client = new Client(
    { hostname: 'localhost', protocol: 'http:' },
    { socketPath: app.getManagementApiUrl(), keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }
  )

  t.after(async () => {
    await client.close()
    await app.close()
  })

  const config = await app.getRuntimeConfig()
  strictEqual(config.metrics.enabled, false)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metrics',
    headers: { Accept: 'application/json' }
  })
  strictEqual(statusCode, 501)
  deepStrictEqual(await body.json(), {
    statusCode: 501,
    code: 'PLT_RUNTIME_METRICS_DISABLED',
    error: 'Not Implemented',
    message: 'Metrics are disabled.'
  })
})

test('should enable and disable metrics via the management API without losing configuration', async t => {
  const { app, client } = await createMetricsRuntime(t, {
    enabled: false,
    hostname: '127.0.0.1',
    port: 0,
    endpoint: '/custom-metrics',
    applicationLabel: 'serviceId',
    labels: { environment: 'test' },
    timeout: 1500,
    httpClientMetrics: true
  })
  const initialConfig = app.getRuntimeConfig().metrics
  const workers = await app.getWorkers()

  for (const enabled of [true, false, true]) {
    const update = await client.request({
      method: 'PATCH',
      path: '/api/v1/metrics',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled })
    })
    strictEqual(update.statusCode, 200)
    deepStrictEqual(await update.body.json(), { success: true, config: { ...initialConfig, enabled } })

    const result = await client.request({
      method: 'GET',
      path: '/api/v1/metrics',
      headers: { accept: 'application/json' }
    })
    strictEqual(result.statusCode, enabled ? 200 : 501)
    const response = await result.body.json()

    if (enabled) {
      // Process metrics must also exist when the runtime started with metrics disabled.
      ok(response.some(metric => metric.name === 'process_resident_memory_bytes'))
      ok(response.some(metric => metric.name === 'nodejs_version_info'))
      ok(response.some(metric => metric.values.some(value => value.labels.serviceId)))
      for (const metric of response) {
        for (const value of metric.values) {
          strictEqual(value.labels.environment, 'test')
        }
      }
    } else {
      strictEqual(response.code, 'PLT_RUNTIME_METRICS_DISABLED')
    }

    deepStrictEqual(await app.getWorkers(), workers)
  }

  // Supplying a nested object replaces it without applying unrelated schema defaults.
  const update = await client.request({
    method: 'PATCH',
    path: '/api/v1/metrics',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ labels: { region: 'eu' } })
  })
  strictEqual(update.statusCode, 200)
  deepStrictEqual((await update.body.json()).config, {
    ...initialConfig,
    enabled: true,
    labels: { region: 'eu' }
  })
})

test('should enable metrics initially configured as false or omitted', async t => {
  for (const initialMetrics of [false, undefined]) {
    await t.test(String(initialMetrics), async t => {
      const { client } = await createMetricsRuntime(t, initialMetrics)
      const update = await client.request({
        method: 'PATCH',
        path: '/api/v1/metrics',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true, port: 0, hostname: '127.0.0.1' })
      })
      strictEqual(update.statusCode, 200)
      strictEqual((await update.body.json()).config.enabled, true)

      const result = await client.request({ method: 'GET', path: '/api/v1/metrics' })
      strictEqual(result.statusCode, 200)
      ok((await result.body.text()).includes('process_resident_memory_bytes'))
    })
  }
})

test('should preserve counters and listeners for identical metrics updates', async t => {
  for (const initialOptions of [{ enabled: true }, {}]) {
    await t.test(JSON.stringify(initialOptions), async t => {
      const { app, client } = await createMetricsRuntime(t, { ...initialOptions, port: 0, hostname: '127.0.0.1' })
      const workers = Object.values(await app.getWorkers(true))
      const sends = workers.map(({ raw }) => t.mock.method(raw[kITC], 'send'))

      // A no-op update must not propagate a registry reset to the workers.
      const update = await client.request({
        method: 'PATCH',
        path: '/api/v1/metrics',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      })
      strictEqual(update.statusCode, 200)
      strictEqual((await update.body.json()).success, true)
      for (const send of sends) {
        ok(!send.mock.calls.some(call => call.arguments[0] === 'updateMetricsConfig'))
      }
    })
  }
})

test('should serialize concurrent metrics configuration updates', async t => {
  const { app } = await createMetricsRuntime(t, { enabled: false, port: 0, hostname: '127.0.0.1' })

  const results = await Promise.all([
    app.updateMetricsConfig({ enabled: true }),
    app.updateMetricsConfig({ labels: { environment: 'test' } }),
    app.updateMetricsConfig({ enabled: false })
  ])

  strictEqual(results[0].config.enabled, true)
  deepStrictEqual(results[1].config.labels, { environment: 'test' })
  strictEqual(results[2].config.enabled, false)
  deepStrictEqual(app.getRuntimeConfig().metrics, results[2].config)
})

test('should reject invalid metrics updates without changing the configuration', async t => {
  const { app, client } = await createMetricsRuntime(t, { enabled: false, port: 0 })
  const initialConfig = app.getRuntimeConfig().metrics

  for (const payload of [{}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }, { unknown: true }, false, []]) {
    const result = await client.request({
      method: 'PATCH',
      path: '/api/v1/metrics',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
    strictEqual(result.statusCode, 400, JSON.stringify(payload))
    strictEqual((await result.body.json()).code, 'FST_ERR_VALIDATION')
    deepStrictEqual(app.getRuntimeConfig().metrics, initialConfig)
  }
})

test('should report worker metrics update failures and allow retrying the same configuration', async t => {
  const { app, client } = await createMetricsRuntime(t, { enabled: false, port: 0, hostname: '127.0.0.1' })
  const { raw } = Object.values(await app.getWorkers(true))[0]
  const originalSend = raw[kITC].send.bind(raw[kITC])
  const send = t.mock.method(raw[kITC], 'send', async (name, ...args) => {
    if (name === 'updateMetricsConfig') {
      throw new Error('Metrics update failed')
    }
    return originalSend(name, ...args)
  })

  const failed = await client.request({
    method: 'PATCH',
    path: '/api/v1/metrics',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  })
  strictEqual(failed.statusCode, 500)
  strictEqual((await failed.body.json()).code, 'PLT_RUNTIME_FAILED_TO_UPDATE_METRICS_CONFIG')
  send.mock.restore()

  const retry = await client.request({
    method: 'PATCH',
    path: '/api/v1/metrics',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  })
  strictEqual(retry.statusCode, 200)
  strictEqual((await retry.body.json()).success, true)
  const result = await client.request({ method: 'GET', path: '/api/v1/metrics' })
  strictEqual(result.statusCode, 200)
  ok((await result.body.text()).includes('nodejs_heap_size_used_bytes'))
})

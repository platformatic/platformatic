'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { request } = require('undici')
const { setLogFile } = require('./helpers')

test.beforeEach(setLogFile)

const { create } = require('../index.js')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('Hello', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/'
  })
  assert.strictEqual(statusCode, 200)

  const responseText = await body.text()

  assert.strictEqual(
    responseText,
    `Hello from Platformatic Prometheus Server!
The metrics are available at /metrics.
The readiness endpoint is available at /ready.
The liveness endpoint is available at /status.`
  )
})

test('Hello without readiness', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'readiness-disabled.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/'
  })
  assert.strictEqual(statusCode, 200)

  const responseText = await body.text()

  assert.strictEqual(
    responseText,
    `Hello from Platformatic Prometheus Server!
The metrics are available at /metrics.
The liveness endpoint is available at /status.`
  )
})

test('Hello without liveness', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'liveness-disabled.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/'
  })
  assert.strictEqual(statusCode, 200)

  const responseText = await body.text()

  assert.strictEqual(
    responseText,
    `Hello from Platformatic Prometheus Server!
The metrics are available at /metrics.
The readiness endpoint is available at /ready.`
  )
})

test('should start a prometheus server on port 9090', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics'
  })
  assert.strictEqual(statusCode, 200)

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
    'thread_cpu_user_system_seconds_total',
    'thread_cpu_system_seconds_total',
    'thread_cpu_seconds_total',
    'thread_cpu_percent_usage',
    'http_request_all_duration_seconds',
    'http_request_all_summary_seconds',
    'http_cache_hit_count',
    'http_cache_miss_count',
    'http_client_stats_free',
    'http_client_stats_connected',
    'http_client_stats_pending',
    'http_client_stats_queued',
    'http_client_stats_running',
    'http_client_stats_size'
  ]

  for (const metricName of expectedMetricNames) {
    assert.ok(metricsNames.includes(metricName), `Expected metric ${metricName} to be present`)
  }
})

test('should support custom metrics', async t => {
  const projectDir = join(fixturesDir, 'custom-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics'
  })
  assert.strictEqual(statusCode, 200)

  const metrics = await body.text()

  assert.ok(metrics.includes('# HELP custom_service_1 Custom Service 1'))
  assert.ok(metrics.includes('# TYPE custom_service_1 counter'))
  assert.ok(metrics.includes('custom_service_1{serviceId="service"} 123'))
  assert.ok(metrics.includes('# HELP custom_service_2 Custom Service 2'))
  assert.ok(metrics.includes('# TYPE custom_service_2 gauge'))
  assert.ok(metrics.includes('custom_service_2{serviceId="service"} 456'))

  assert.ok(metrics.includes('# HELP custom_internal_1 Custom Internal 1'))
  assert.ok(metrics.includes('# TYPE custom_internal_1 counter'))
  assert.ok(metrics.includes('custom_internal_1{serviceId="internal"} 123'))
  assert.ok(metrics.includes('# HELP custom_internal_2 Custom Internal 2'))
  assert.ok(metrics.includes('# TYPE custom_internal_2 gauge'))
  assert.ok(metrics.includes('custom_internal_2{serviceId="internal"} 456'))

  assert.ok(metrics.includes('# HELP custom_external_1 Custom External 1'))
  assert.ok(metrics.includes('# TYPE custom_external_1 counter'))
  assert.ok(metrics.includes('custom_external_1{serviceId="external"} 123'))
  assert.ok(metrics.includes('# HELP custom_external_2 Custom External 2'))
  assert.ok(metrics.includes('# TYPE custom_external_2 gauge'))
  assert.ok(metrics.includes('custom_external_2{serviceId="external"} 456'))
})

test('should track http cache hits/misses', async t => {
  const projectDir = join(fixturesDir, 'http-cache')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })
    assert.strictEqual(res.statusCode, 200)
  }

  await sleep(cacheTimeoutSec * 1000)

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })
    assert.strictEqual(res.statusCode, 200)
  }

  {
    const res = await request(entryUrl + '/service-2/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })
    assert.strictEqual(res.statusCode, 200)
  }

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/metrics'
  })
  assert.strictEqual(statusCode, 200)

  const metrics = await body.text()

  assert.ok(metrics.match(/http_cache_hit_count\{serviceId="main"\} \d+/))
  assert.ok(metrics.match(/http_cache_miss_count\{serviceId="main"\} \d+/))

  assert.ok(metrics.includes('http_cache_hit_count{serviceId="service-1"} 0'))
  assert.ok(metrics.includes('http_cache_miss_count{serviceId="service-1"} 0'))

  assert.ok(metrics.includes('http_cache_hit_count{serviceId="service-2"} 0'))
  assert.ok(metrics.includes('http_cache_miss_count{serviceId="service-2"} 1'))
})

test('metrics can be disabled', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'metrics-disabled.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  await t.assert.rejects(
    request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/metrics'
    })
  )
})

test('readiness - should get 404 if readiness is not enabled', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'readiness-disabled.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/ready'
  })
  assert.strictEqual(statusCode, 404)
})

test('readiness - should expose readiness by default and get a success response when all services are started, with default settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/ready'
  })
  assert.strictEqual(statusCode, 200)
  assert.strictEqual(await body.text(), 'OK')
})

test('readiness - should expose readiness and get a fail response when not all services are started, with default settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { services } = await app.getServices()
  await app.stopService(services[0].id)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/ready'
  })
  assert.strictEqual(statusCode, 500)
  assert.strictEqual(await body.text(), 'ERR')
})

test('readiness - should expose readiness and get a fail and success responses with custom settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'readiness-custom.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/health'
    })
    assert.strictEqual(statusCode, 201)
    assert.strictEqual(await body.text(), 'All right')
  }

  const { services } = await app.getServices()
  await app.stopService(services[0].id)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/health'
    })
    assert.strictEqual(statusCode, 501)
    assert.strictEqual(await body.text(), 'No good')
  }
})

test('liveness - should get 404 if liveness is not enabled', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'liveness-disabled.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/status'
  })
  assert.strictEqual(statusCode, 404)
})

test('liveness - should expose liveness by default and get a success response when all services are started, with default settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/status'
  })
  assert.strictEqual(statusCode, 200)
  assert.strictEqual(await body.text(), 'OK')
})

test('liveness - should expose liveness and get a fail response when not all services are ready, with default settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const { services } = await app.getServices()
  await app.stopService(services[0].id)

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/status'
  })
  assert.strictEqual(statusCode, 500)
  assert.strictEqual(await body.text(), 'ERR')
})

test('liveness - should expose liveness and get a fail response when not all services are healthy, with default settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  await request(entryUrl, {
    path: '/service-node/set/status',
    query: { status: false }
  })

  const { statusCode, body } = await request('http://127.0.0.1:9090', {
    method: 'GET',
    path: '/status'
  })
  assert.strictEqual(statusCode, 500)
  assert.strictEqual(await body.text(), 'ERR')
})

test('liveness - should expose liveness and get a fail and success responses with custom settings', async t => {
  const projectDir = join(fixturesDir, 'prom-server')
  const configFile = join(projectDir, 'liveness-custom.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 201)
    assert.strictEqual(await body.text(), 'All right')
  }

  await request(entryUrl, {
    path: '/service-node/set/status',
    query: { status: false }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 501)
    assert.strictEqual(await body.text(), 'No good')
  }
})

test('liveness - should respond to liveness with a custom content from setCustomHealthCheck', async t => {
  const projectDir = join(fixturesDir, 'healthcheck-custom-response')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 201)
    assert.strictEqual(await body.text(), 'All right')
  }

  await request(entryUrl, {
    path: '/service/set/status',
    query: { status: false, body: 'Database is unreachable', statusCode: 500 }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 500)
    assert.strictEqual(await body.text(), 'Database is unreachable')
  }

  await request(entryUrl, {
    path: '/service/set/status',
    query: { status: true, body: 'Everything is fine', statusCode: 211 }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 211)
    assert.strictEqual(await body.text(), 'Everything is fine')
  }
})

test('liveness - should respond to liveness with the response from settings when setCustomHealthCheck does not return a response', async t => {
  const projectDir = join(fixturesDir, 'healthcheck-custom-response')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 201)
    assert.strictEqual(await body.text(), 'All right')
  }

  await request(entryUrl, {
    path: '/service/set/status',
    query: { status: false }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 501)
    assert.strictEqual(await body.text(), 'No good')
  }

  await request(entryUrl, {
    path: '/service/set/status',
    query: { status: true }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/live'
    })
    assert.strictEqual(statusCode, 201)
    assert.strictEqual(await body.text(), 'All right')
  }
})

test('readiness - should respond to readiness with a custom content from setCustomReadinessCheck', async t => {
  const projectDir = join(fixturesDir, 'readiness-custom-response')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(await body.text(), 'All ready')
  }

  await request(entryUrl, {
    path: '/service/set/ready',
    query: { status: false, body: 'Database is unreachable', statusCode: 502 }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 502)
    assert.strictEqual(await body.text(), 'Database is unreachable')
  }

  await request(entryUrl, {
    path: '/service/set/ready',
    query: { status: true, body: 'Everything is ready', statusCode: 202 }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 202)
    assert.strictEqual(await body.text(), 'Everything is ready')
  }
})

test('readiness - should respond to readiness with the response from settings when setCustomReadinessCheck does not return a response', async t => {
  const projectDir = join(fixturesDir, 'readiness-custom-response')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(await body.text(), 'All ready')
  }

  await request(entryUrl, {
    path: '/service/set/ready',
    query: { status: false }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 502)
    assert.strictEqual(await body.text(), 'Not ready')
  }

  await request(entryUrl, {
    path: '/service/set/ready',
    query: { status: true }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/readiness'
    })
    assert.strictEqual(statusCode, 202)
    assert.strictEqual(await body.text(), 'All ready')
  }
})

test('liveness - should respond to liveness with the custom readiness response from setCustomHealthCheck on liveness failure consequent of readiness check failure', async t => {
  const projectDir = join(fixturesDir, 'readiness-custom-response')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Wait for the prometheus server to start
  await sleep(2000)

  await request(entryUrl, {
    path: '/service/set/health',
    query: { status: true }
  })
  await request(entryUrl, {
    path: '/service/set/ready',
    query: { status: false, body: 'Not ready', statusCode: 502 }
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:9090', {
      method: 'GET',
      path: '/status'
    })
    assert.strictEqual(statusCode, 500)
    assert.strictEqual(await body.text(), 'Not ready')
  }
})

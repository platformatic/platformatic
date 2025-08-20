import { safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import split from 'split2'
import { RuntimeApiClient } from '../lib/index.js'
import { kill, startRuntime } from './helper.js'

const fixturesDir = join(import.meta.dirname, 'fixtures')

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

test('should get runtime metrics', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

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
    'http_request_all_summary_seconds'
  ]

  {
    const runtimeTextMetrics = await runtimeClient.getRuntimeMetrics(runtime.pid)
    const metricsNames = runtimeTextMetrics
      .split('\n')
      .filter(line => line && line.startsWith('# TYPE'))
      .map(line => line.split(' ')[2])

    for (const metricName of expectedMetricNames) {
      assert.ok(metricsNames.includes(metricName), `Missing metric: ${metricName}`)
    }
  }

  {
    const runtimeJsonMetrics = await runtimeClient.getRuntimeMetrics(runtime.pid, { format: 'json' })

    for (const metricName of expectedMetricNames) {
      const foundMetrics = runtimeJsonMetrics.filter(m => m.name === metricName)
      assert.ok(foundMetrics.length > 0, `Missing metric: ${metricName}`)
    }
  }
})

test('should get runtime live metrics', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  // Wait for the runtime to collect some metrics
  await sleep(5000)

  const runtimeClient = new RuntimeApiClient()
  const runtimeMetricsStream = runtimeClient.getRuntimeLiveMetricsStream(runtime.pid)

  let count = 0
  await new Promise((resolve, reject) => {
    runtimeMetricsStream.pipe(
      split(record => {
        if (count++ > 10) resolve()

        const { applications } = JSON.parse(record)

        assert.deepStrictEqual(Object.keys(applications).sort(), ['service-1', 'service-2'].sort())

        for (const applicationMetrics of Object.values(applications)) {
          assert.deepStrictEqual(
            Object.keys(applicationMetrics).sort(),
            ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
          )

          const latencyMetrics = applicationMetrics.latency
          const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
          assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
        }
      })
    )
  })
})

test('should get matching runtime', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  const runtimeClient = new RuntimeApiClient()
  const { pid, url } = await runtimeClient.getMatchingRuntime()
  assert.strictEqual(typeof pid, 'number')
  assert.strictEqual(typeof url, 'string')
})

test('should get runtime OpenAPI definition', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  const runtimeClient = new RuntimeApiClient()
  const openapi = await runtimeClient.getRuntimeOpenapi(runtime.pid, 'service-1')
  assert.deepEqual(
    {
      openapi: '3.0.3',
      info: {
        title: 'Platformatic',
        description: 'This is a service built on top of Platformatic',
        version: '1.0.0'
      },
      components: { schemas: {} },
      paths: {
        '/hello': {
          get: {
            responses: {
              200: {
                description: 'Default Response'
              }
            }
          }
        },
        '/mirror': {
          post: {
            responses: {
              200: {
                description: 'Default Response'
              }
            }
          }
        }
      },
      servers: [{ url: '/' }]
    },
    openapi,
    'valid application name is passed'
  )

  let error
  try {
    await runtimeClient.getRuntimeOpenapi(runtime.pid, 'invalid')
  } catch (err) {
    error = err
  }
  assert.strictEqual(error.code, 'PLT_CTR_FAILED_TO_GET_RUNTIME_OPENAPI', 'invalid runtime application name passed')
})

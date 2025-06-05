'use strict'

import { createDirectory, safeRemove } from '@platformatic/utils'
import * as desm from 'desm'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import split from 'split2'
import { RuntimeApiClient } from '../index.js'
import { startRuntime, kill } from './helper.mjs'

const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get runtime log indexes', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const logIndexes = await runtimeClient.getRuntimeLogIndexes(runtime.pid)

  assert.deepStrictEqual(logIndexes, [1, 42])
})

test('should get all runtime log indexes', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const prevRuntimePID = 424242
  const prevTestLogs = 'test-logs-42\n'
  const prevRuntimeLogsDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await createDirectory(prevRuntimeLogsDir)
  await writeFile(join(prevRuntimeLogsDir, 'logs.41'), prevTestLogs)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const logIndexes = await runtimeClient.getRuntimeLogIndexes(runtime.pid, { all: true })

  assert.deepStrictEqual(logIndexes, [
    {
      pid: prevRuntimePID,
      indexes: [41],
    },
    {
      pid: runtime.pid,
      indexes: [1, 42],
    },
  ])
})

test('should get runtime history log', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeLogsStream(runtime.pid, 42)
  const runtimeLogs = await runtimeLogsStream.text()
  assert.strictEqual(runtimeLogs, testLogs)
})

test('should get runtime history log for prev run', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const prevRuntimePID = 424242
  const prevTestLogs = 'test-logs-41\n'
  const prevRuntimeLogsDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await createDirectory(prevRuntimeLogsDir)
  await writeFile(join(prevRuntimeLogsDir, 'logs.41'), prevTestLogs)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeLogsStream(runtime.pid, 41, {
    runtimePID: prevRuntimePID,
  })
  const runtimeLogs = await runtimeLogsStream.text()
  assert.strictEqual(runtimeLogs, prevTestLogs)
})

test('should get runtime all logs', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.2'), testLogs)
  await writeFile(join(runtimeLogsDir, 'logs.3'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeAllLogsStream(runtime.pid)
  const runtimeLogs = await runtimeLogsStream.text()

  const logsLines = runtimeLogs.split('\n')
  const logsLinesCount = logsLines.length
  assert(logsLinesCount > 3)

  assert.strictEqual(logsLines.at(-2) + '\n', testLogs)
  assert.strictEqual(logsLines.at(-3) + '\n', testLogs)
})

test('should get runtime all logs for prev run', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const prevRuntimePID = 424242
  const prevTestLogs = 'test-logs-41\n'
  const prevRuntimeLogsDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await createDirectory(prevRuntimeLogsDir)
  await writeFile(join(prevRuntimeLogsDir, 'logs.2'), prevTestLogs)
  await writeFile(join(prevRuntimeLogsDir, 'logs.3'), prevTestLogs)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeAllLogsStream(runtime.pid, {
    runtimePID: prevRuntimePID,
  })
  const runtimeLogs = await runtimeLogsStream.text()

  const logsLines = runtimeLogs.split('\n')
  assert.strictEqual(logsLines.at(-2) + '\n', prevTestLogs)
  assert.strictEqual(logsLines.at(-3) + '\n', prevTestLogs)
})

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
    'http_request_all_summary_seconds',
  ]

  {
    const runtimeTextMetrics = await runtimeClient.getRuntimeMetrics(
      runtime.pid
    )
    const metricsNames = runtimeTextMetrics
      .split('\n')
      .filter(line => line && line.startsWith('# TYPE'))
      .map(line => line.split(' ')[2])

    for (const metricName of expectedMetricNames) {
      assert.ok(metricsNames.includes(metricName), `Missing metric: ${metricName}`)
    }
  }

  {
    const runtimeJsonMetrics = await runtimeClient.getRuntimeMetrics(
      runtime.pid, { format: 'json' }
    )

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
  t.after(async () => { await kill(runtime) })

  // Wait for the runtime to collect some metrics
  await sleep(5000)

  const runtimeClient = new RuntimeApiClient()
  const runtimeMetricsStream = runtimeClient.getRuntimeLiveMetricsStream(runtime.pid)

  let count = 0
  await new Promise((resolve, reject) => {
    runtimeMetricsStream.pipe(
      split(record => {
        if (count++ > 10) resolve()

        const { services } = JSON.parse(record)

        assert.deepStrictEqual(
          Object.keys(services).sort(),
          ['service-1', 'service-2'].sort()
        )

        for (const serviceMetrics of Object.values(services)) {
          assert.deepStrictEqual(Object.keys(serviceMetrics).sort(), [
            'cpu',
            'elu',
            'newSpaceSize',
            'oldSpaceSize',
            'rss',
            'totalHeapSize',
            'usedHeapSize',
            'latency',
          ].sort())

          const latencyMetrics = serviceMetrics.latency
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
  t.after(async () => { await kill(runtime) })

  const runtimeClient = new RuntimeApiClient()
  const { pid, url } = await runtimeClient.getMatchingRuntime()
  assert.strictEqual(typeof pid, 'number')
  assert.strictEqual(typeof url, 'string')
})

test('should get runtime OpenAPI definition', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(async () => { await kill(runtime) })

  const runtimeClient = new RuntimeApiClient()
  const openapi = await runtimeClient.getRuntimeOpenapi(runtime.pid, 'service-1')
  assert.deepEqual({
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
    servers: [
      { url: '/' }
    ]
  }, openapi, 'valid service name is passed')

  let error
  try {
    await runtimeClient.getRuntimeOpenapi(runtime.pid, 'invalid')
  } catch (err) {
    error = err
  }
  assert.strictEqual(error.code, 'PLT_CTR_FAILED_TO_GET_RUNTIME_OPENAPI', 'invalid runtime service name passed')
})

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

function getRuntimeLogsDir (runtimeDir, runtimePID) {
  const runtimeTmpDir = getRuntimeTmpDir(runtimeDir)
  return join(runtimeTmpDir, runtimePID.toString(), 'logs')
}

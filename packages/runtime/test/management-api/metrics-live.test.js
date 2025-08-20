'use strict'

const assert = require('node:assert')
const { platform } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const WebSocket = require('ws')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime metrics via management api', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/metrics/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', err => {
      reject(err)
    })

    let count = 0

    webSocket.on('message', data => {
      if (count++ > 5) {
        webSocket.removeAllListeners('message')
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }

      const records = data.toString().split('\n')
      for (const record of records) {
        if (!record) continue
        const { applications } = JSON.parse(record)

        assert.deepStrictEqual(Object.keys(applications).sort(), ['service-1', 'service-2', 'service-db'].sort())

        for (const applicationMetrics of Object.values(applications)) {
          assert.deepStrictEqual(
            Object.keys(applicationMetrics).sort(),
            ['cpu', 'elu', 'newSpaceSize', 'oldSpaceSize', 'rss', 'totalHeapSize', 'usedHeapSize', 'latency'].sort()
          )

          const latencyMetrics = applicationMetrics.latency
          const latencyMetricsKeys = Object.keys(latencyMetrics).sort()
          assert.deepStrictEqual(latencyMetricsKeys, ['p50', 'p90', 'p95', 'p99'])
        }
      }
    })
  })
})

test('should not throw if metrics are not enabled', async t => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/metrics/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', err => {
      reject(err)
    })

    let count = 0

    webSocket.on('message', data => {
      if (count++ > 3) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }

      const records = data.toString().split('\n')

      for (const record of records) {
        if (!record) continue
        const metrics = JSON.parse(record)
        assert.strictEqual(metrics, null)
      }
    })
  })
})

'use strict'

const assert = require('node:assert')
const { platform } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const WebSocket = require('ws')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime metrics via management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const socketPath = app.managementApi.server.address()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/metrics/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    let count = 0

    webSocket.on('message', (data) => {
      if (count++ > 5) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }

      const records = data.toString().split('\n')
      for (const record of records) {
        if (!record) continue
        const metrics = JSON.parse(record)
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
      }
    })
  })
})

test('should not throw if entrypoint does not have metrics enabled', async (t) => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const socketPath = app.managementApi.server.address()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/metrics/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    let count = 0

    webSocket.on('message', (data) => {
      if (count++ > 5) {
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

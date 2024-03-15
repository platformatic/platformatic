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

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    webSocket.on('message', (data) => {
      data = data.toString()
      if (!data) return
      clearTimeout(timeout)
      webSocket.close()

      const metrics = JSON.parse(data)
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
      resolve()
    })
  })
})

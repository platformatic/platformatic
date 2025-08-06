'use strict'

const assert = require('node:assert')
const { platform, tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { readFile, writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')
const WebSocket = require('ws')

const { create } = require('../..')
const { safeRemove } = require('@platformatic/foundation')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get runtime logs via management api', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    webSocket.on('error', err => {
      reject(err)
    })

    webSocket.on('message', data => {
      if (data.includes('Server listening at')) {
        clearTimeout(timeout)

        setImmediate(() => {
          webSocket.terminate()
          resolve()
        })
      }
    })
  })
})

test('should get runtime logs via management api (with a start index)', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs',
  })
  assert.strictEqual(res.statusCode, 200)

  const socketPath = app.getManagementApiUrl()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  // Wait for logs to be written
  await sleep(5000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes',
  })
  assert.strictEqual(statusCode, 200)

  const { indexes } = await body.json()
  const startLogId = indexes.at(-1)

  // Wait for logs to be written to the latest file
  await sleep(5000)

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live' + `?start=${startLogId}`)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 100000)

    webSocket.on('error', err => {
      reject(err)
    })

    let counter = 0
    webSocket.on('message', () => {
      if (counter++ > 3) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })
})

test('should support custom use transport', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configPath = join(projectDir, 'platformatic.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  const logsPath = join(tmpdir(), 'platformatic-management-api-logs.txt')
  await safeRemove(logsPath)

  config.logger = {
    level: 'trace',
    transport: {
      target: 'pino/file',
      options: { destination: logsPath },
    },
  }

  const configWithLoggerPath = join(projectDir, 'platformatic-custom-logger.json')
  await writeFile(configWithLoggerPath, JSON.stringify(config, null, 2))

  const app = await create(configWithLoggerPath)
  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(configWithLoggerPath)
    await safeRemove(logsPath)
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 30_000)

    webSocket.on('error', err => {
      reject(err)
    })

    webSocket.on('message', data => {
      if (data.toString().includes('Platformatic is now listening at')) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })

  // Wait for logs to be written
  await sleep(1_000)

  const logs = await readFile(logsPath, 'utf8')
  assert.ok(logs.includes('Platformatic is now listening at'))
})

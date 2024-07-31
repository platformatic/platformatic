'use strict'

const assert = require('node:assert')
const { platform, tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { readFile, writeFile, rm } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')
const WebSocket = require('ws')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime logs via management api', async (t) => {
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
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 100000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    webSocket.on('message', (data) => {
      if (data.includes('Server listening at')) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })
})

test('should get runtime logs via management api (with a start index)', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs',
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(3000)

  const socketPath = app.managementApi.server.address()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes',
  })
  assert.strictEqual(statusCode, 200)

  const { indexes } = await body.json()
  const startLogId = indexes[1]

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(
    protocol + socketPath + ':/api/v1/logs/live' + `?start=${startLogId}`
  )

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 100000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    let counter = 0
    webSocket.on('message', () => {
      if (counter++ > 10) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })
})

test('should support custom use transport with a message port logging', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configPath = join(projectDir, 'platformatic.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  const logsPath = join(tmpdir(), 'platformatic-management-api-logs.txt')
  await rm(logsPath).catch(() => {})

  config.server.logger = {
    level: 'trace',
    transport: {
      target: 'pino/file',
      options: { destination: logsPath },
    },
  }

  const configWithLoggerPath = join(projectDir, 'platformatic-custom-logger.json')
  await writeFile(configWithLoggerPath, JSON.stringify(config, null, 2))

  const app = await buildServer(configWithLoggerPath)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(configWithLoggerPath)
    await rm(logsPath)
  })

  const socketPath = app.managementApi.server.address()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 100000)

    webSocket.on('error', (err) => {
      reject(err)
    })

    webSocket.on('message', (data) => {
      if (data.includes('Server listening at')) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })

  // Wait for logs to be written
  await sleep(1000)

  const logs = await readFile(logsPath, 'utf8')
  assert.ok(logs.includes('Server listening at'))
})

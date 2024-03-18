'use strict'

const assert = require('node:assert')
const { platform, tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { readFile, writeFile, rm } = require('node:fs/promises')
const WebSocket = require('ws')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const skip = platform() === 'win32'

test('should get runtime logs via management api', { skip }, async (t) => {
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

test('should support custom use transport with a message port logging', { skip }, async (t) => {
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
      options: { destination: logsPath }
    }
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

  const logs = await readFile(logsPath, 'utf8')
  assert.ok(logs.includes('Server listening at'))
})

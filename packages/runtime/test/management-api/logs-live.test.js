'use strict'

const assert = require('node:assert')
const { platform } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { readFile, writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const WebSocket = require('ws')

const { createRuntime, getTempDir } = require('../helpers.js')
const { safeRemove } = require('@platformatic/foundation')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime logs via management api', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.init()

  t.after(async () => {
    await app.close()
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    webSocket.on('error', err => {
      reject(err)
    })

    webSocket.on('message', data => {
      if (data.includes('Platformatic is now listening')) {
        clearTimeout(timeout)

        setImmediate(() => {
          webSocket.terminate()
          resolve()
        })
      }
    })
  })

  await app.start()
  await promise
})

test('should support custom use transport', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configPath = join(projectDir, 'platformatic.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  const logsPath = join(await getTempDir(), 'platformatic-management-api-logs.txt')
  await safeRemove(logsPath)

  config.logger = {
    level: 'trace',
    transport: {
      target: 'pino/file',
      options: { destination: logsPath }
    }
  }

  const configWithLoggerPath = join(projectDir, 'platformatic-custom-logger.json')
  await writeFile(configWithLoggerPath, JSON.stringify(config, null, 2))

  const app = await createRuntime(configWithLoggerPath)
  await app.init()

  t.after(async () => {
    await app.close()
    await safeRemove(configWithLoggerPath)
    await safeRemove(logsPath)
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  const promise = new Promise((resolve, reject) => {
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

  await app.start()
  await promise

  // Wait for logs to be written
  await sleep(1_000)

  const logs = await readFile(logsPath, 'utf8')
  assert.ok(logs.includes('Platformatic is now listening at'))
})

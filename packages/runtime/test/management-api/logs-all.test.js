'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { rm, mkdir, writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')
const { getRuntimeTmpDir, getRuntimeLogsDir } = require('../../lib/api-client')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get all runtime logs', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })

  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs'
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(3000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all'
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.text()

  const logsSize = Buffer.byteLength(data, 'utf8')
  const logsSizeMb = logsSize / 1024 / 1024
  assert(logsSizeMb > 10)
})

test('should get previous runtime logs', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })

  const prevRuntimePID = '424242'
  const prevRuntimeTmpDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await mkdir(prevRuntimeTmpDir, { recursive: true })

  await Promise.all([
    writeFile(join(prevRuntimeTmpDir, 'logs.1'), 'test-logs-1\n'),
    writeFile(join(prevRuntimeTmpDir, 'logs.2'), 'test-logs-2\n'),
    writeFile(join(prevRuntimeTmpDir, 'logs.3'), 'test-logs-3\n'),
    writeFile(join(prevRuntimeTmpDir, 'logs.4'), 'test-logs-4\n'),
    writeFile(join(prevRuntimeTmpDir, 'logs.5'), 'test-logs-5\n')
  ])

  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all',
    query: {
      pid: prevRuntimePID
    }
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.strictEqual(
    data,
    'test-logs-1\n' +
    'test-logs-2\n' +
    'test-logs-3\n' +
    'test-logs-4\n' +
    'test-logs-5\n'
  )
})

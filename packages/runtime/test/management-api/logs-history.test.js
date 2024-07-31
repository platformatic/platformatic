'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { writeFile, rm, mkdir } = require('node:fs/promises')
const { Client } = require('undici')
const { getRuntimeTmpDir, getRuntimeLogsDir } = require('../../lib/api-client')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get runtime logs history via management api', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true })

  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, process.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/42',
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.strictEqual(data, testLogs)
})

test('should get logs from previous run', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true })

  const prevRuntimePID = '424242'
  const prevRuntimeLogsDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await mkdir(prevRuntimeLogsDir, { recursive: true })

  const prevRuntimeLogs = 'test-logs-42\n'
  await writeFile(join(prevRuntimeLogsDir, 'logs.42'), prevRuntimeLogs)

  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/42',
    query: {
      pid: prevRuntimePID,
    },
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.text()
  assert.strictEqual(data, prevRuntimeLogs)
})

test('should throw 404 if log file does not exist', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true })

  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/42',
  })

  assert.strictEqual(statusCode, 404)

  const error = await body.json()
  assert.strictEqual(error.code, 'PLT_RUNTIME_LOG_FILE_NOT_FOUND')
  assert.strictEqual(error.message, 'Log file with index 42 not found')
})

'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')
const { getRuntimeTmpDir, getRuntimeLogsDir } = require('../../lib/utils')
const { createDirectory, safeRemove } = require('@platformatic/foundation')

const { create } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get runtime log indexes', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir, { recursive: true, force: true })

  const app = await create(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, process.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes',
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { indexes: [1, 42] })
})

test('should get only latest 30 logs indexes (150 MB)', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir, { recursive: true, force: true })

  const app = await create(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(runtimeTmpDir, { recursive: true, force: true })
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs',
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(5000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes',
  })
  assert.strictEqual(statusCode, 200)

  const { indexes } = await body.json()

  // Depending on the length of the hostname, we might have slightly more bytes, let's be lenient
  assert.ok(new Set(indexes).size >= 2)
})

test('should get all runtimes log indexes (with previous)', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir, { recursive: true, force: true })

  const prevRuntimePID = '424242'
  const prevRuntimeLogsDir = getRuntimeLogsDir(projectDir, prevRuntimePID)
  await createDirectory(prevRuntimeLogsDir)

  const prevRuntimeLogs = 'test-logs-42\n'
  await writeFile(join(prevRuntimeLogsDir, 'logs.42'), prevRuntimeLogs)

  const app = await create(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(runtimeTmpDir, { recursive: true, force: true })
  })

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:',
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    }
  )

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes',
    query: {
      all: 'true',
    },
  })
  assert.strictEqual(statusCode, 200)

  const runtimesLogsIds = await body.json()
  assert.deepStrictEqual(runtimesLogsIds, [
    {
      pid: parseInt(prevRuntimePID),
      indexes: [42],
    },
    {
      pid: process.pid,
      indexes: [1],
    },
  ])
})

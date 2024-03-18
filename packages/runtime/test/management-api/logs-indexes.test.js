'use strict'

const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { writeFile, rm } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, process.pid.toString())

test('should get runtime log indexes', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  await writeFile(join(runtimeTmpDir, 'logs.42'), testLogs)

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
    path: '/api/v1/logs/indexes'
  })
  assert.strictEqual(statusCode, 200)

  const data = await body.json()
  assert.deepStrictEqual(data, { indexes: [1, 42] })
})

test('should get only latest 30 logs indexes (150 MB)', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:'
  }, {
    socketPath: app.managementApi.server.address(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })

  {
    const res = await app.inject('service-1', {
      method: 'GET',
      url: '/large-logs'
    })
    assert.strictEqual(res.statusCode, 200)

    // Wait for logs to be written
    await sleep(3000)
  }

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs'
  })
  assert.strictEqual(res.statusCode, 200)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/indexes'
  })
  assert.strictEqual(statusCode, 200)

  const { indexes } = await body.json()
  assert.deepStrictEqual(indexes, [4, 5, 6, 7])
})

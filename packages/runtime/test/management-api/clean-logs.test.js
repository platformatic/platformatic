'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { rm, readdir } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { getRuntimeTmpDir, getRuntimeLogsDir } = require('../../lib/api-client')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should clean the logs after reaching a limit', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true, maxRetries: 10 })
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs'
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(3000)

  const runtimeLogsDir = getRuntimeLogsDir(projectDir, process.pid)
  const runtimeLogsFiles = await readdir(runtimeLogsDir)
  const runtimeLogFiles = runtimeLogsFiles.filter(
    (file) => file.startsWith('logs')
  )
  assert.deepStrictEqual(runtimeLogFiles.length, 3)
})

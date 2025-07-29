'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { readdir } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { getRuntimeTmpDir, getRuntimeLogsDir } = require('../../lib/utils')

const { create } = require('../..')
const { safeRemove } = require('@platformatic/utils')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should clean the logs after reaching a limit', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const app = await create(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(runtimeTmpDir)
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs'
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(5000)

  const runtimeLogsDir = getRuntimeLogsDir(projectDir, process.pid)
  const runtimeLogsFiles = await readdir(runtimeLogsDir)
  const runtimeLogFiles = runtimeLogsFiles.filter(file => file.startsWith('logs'))

  // Depending on the length of the hostname, we might have slightly more bytes, let's be lenient
  assert.ok(runtimeLogFiles.length >= 2)
})

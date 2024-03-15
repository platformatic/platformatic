'use strict'

const assert = require('node:assert')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { writeFile, rm, readdir } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, process.pid.toString())

test('should clean the logs after reaching a limit', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  // Wait for start watching the logs
  await sleep(1000)

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  for (let i = 38; i <= 80; i++) {
    await writeFile(join(runtimeTmpDir, `logs.${i}`), testLogs)
  }

  // Wait for the logs to be cleaned
  await sleep(1000)

  const runtimeTmpFiles = await readdir(runtimeTmpDir)
  const runtimeLogFiles = runtimeTmpFiles.filter(
    (file) => file.startsWith('logs')
  )
  assert.ok(runtimeLogFiles.length <= 40)
  assert.ok(runtimeLogFiles.length >= 30)
})

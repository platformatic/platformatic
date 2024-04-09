'use strict'

const assert = require('node:assert')
const { join, dirname } = require('node:path')
const { test } = require('node:test')
const { rm, readdir } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should clean the logs after reaching a limit', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  const runtimeTmpDir = app.getRuntimeTmpDir()
  await rm(dirname(runtimeTmpDir), { recursive: true, force: true })

  await app.start()

  t.after(async () => {
    await app.close()
    await app.managementApi.close()
    await rm(dirname(runtimeTmpDir), { recursive: true, force: true })
  })

  const res = await app.inject('service-1', {
    method: 'GET',
    url: '/large-logs'
  })
  assert.strictEqual(res.statusCode, 200)

  // Wait for logs to be written
  await sleep(3000)

  const runtimeTmpFiles = await readdir(runtimeTmpDir)
  const runtimeLogFiles = runtimeTmpFiles.filter(
    (file) => file.startsWith('logs')
  )
  assert.deepStrictEqual(runtimeLogFiles, [
    'logs.11',
    'logs.12',
    'logs.13'
  ])
})

'use strict'

import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { writeFile, rm } from 'node:fs/promises'
import * as desm from 'desm'
import { RuntimeApiClient } from '../index.js'
import { startRuntime } from './helper.mjs'

const fixturesDir = desm.join(import.meta.url, 'fixtures')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')

test('should get runtime log indexes', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, runtime.pid.toString())
  t.after(async () => {
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  await writeFile(join(runtimeTmpDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const logIndexes = await runtimeClient.getRuntimeLogIndexes(runtime.pid)
  assert.deepStrictEqual(logIndexes, [1, 42])
})

test('should get runtime history log', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, runtime.pid.toString())
  t.after(async () => {
    await rm(runtimeTmpDir, { recursive: true, force: true })
  })

  const testLogs = 'test-logs-42\n'
  await writeFile(join(runtimeTmpDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeLogsStream(runtime.pid, 42)
  const runtimeLogs = await runtimeLogsStream.text()
  assert.strictEqual(runtimeLogs, testLogs)
})

'use strict'

import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { writeFile, rm } from 'node:fs/promises'
import * as desm from 'desm'
import { RuntimeApiClient } from '../index.js'
import { startRuntime } from './helper.mjs'
import split from 'split2'

const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get runtime log indexes', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    runtime.kill('SIGINT')
    await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const logIndexes = await runtimeClient.getRuntimeLogIndexes(runtime.pid)

  assert.deepStrictEqual(logIndexes, [1, 42])
})

test('should get runtime history log', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    runtime.kill('SIGINT')
    await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.42'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeLogsStream(runtime.pid, 42)
  const runtimeLogs = await runtimeLogsStream.text()
  assert.strictEqual(runtimeLogs, testLogs)
})

test('should get runtime all logs', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    runtime.kill('SIGINT')
    await rm(runtimeTmpDir, { recursive: true, force: true }).catch(() => {})
  })

  const testLogs = 'test-logs-42\n'
  const runtimeLogsDir = getRuntimeLogsDir(projectDir, runtime.pid)
  await writeFile(join(runtimeLogsDir, 'logs.2'), testLogs)
  await writeFile(join(runtimeLogsDir, 'logs.3'), testLogs)

  const runtimeClient = new RuntimeApiClient()
  const runtimeLogsStream = await runtimeClient.getRuntimeAllLogsStream(runtime.pid)
  const runtimeLogs = await runtimeLogsStream.text()

  const logsLines = runtimeLogs.split('\n')
  const logsLinesCount = logsLines.length
  assert(logsLinesCount > 3)

  assert.strictEqual(logsLines.at(-2) + '\n', testLogs)
  assert.strictEqual(logsLines.at(-3) + '\n', testLogs)
})

test('should get runtime live metrics', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  // Wait for the runtime to collect some metrics
  await sleep(5000)

  const runtimeClient = new RuntimeApiClient()
  const runtimeMetricsStream = runtimeClient.getRuntimeLiveMetricsStream(runtime.pid)

  let count = 0
  await new Promise((resolve, reject) => {
    runtimeMetricsStream.pipe(split((record) => {
      if (count++ > 10) resolve()

      const metric = JSON.parse(record)
      const metricsKeys = Object.keys(metric).sort()
      assert.deepStrictEqual(metricsKeys, [
        'cpu',
        'date',
        'elu',
        'entrypoint',
        'newSpaceSize',
        'oldSpaceSize',
        'rss',
        'totalHeapSize',
        'usedHeapSize',
        'version'
      ])
    }))
  })
})

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

function getRuntimeLogsDir (runtimeDir, runtimePID) {
  const runtimeTmpDir = getRuntimeTmpDir(runtimeDir)
  return join(runtimeTmpDir, runtimePID.toString(), 'logs')
}

'use strict'

import assert from 'node:assert'
import { tmpdir, platform } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, getPlatformaticVersion } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

const version = await getPlatformaticVersion()

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')

test('should get all runtimes', async (t) => {
  const runtimeProjectDir1 = join(fixturesDir, 'runtime-1')
  const runtimeConfigPath1 = join(runtimeProjectDir1, 'platformatic.json')
  const { runtime: runtime1, url: runtime1Url } = await startRuntime(runtimeConfigPath1)
  t.after(() => runtime1.kill('SIGKILL'))

  const runtimeProjectDir2 = join(fixturesDir, 'runtime-2')
  const runtimeConfigPath2 = join(runtimeProjectDir2, 'platformatic.json')
  const { runtime: runtime2, url: runtime2Url } = await startRuntime(runtimeConfigPath2)
  t.after(() => runtime2.kill('SIGKILL'))

  const child = await execa('node', [cliPath, 'ps'])
  assert.strictEqual(child.exitCode, 0)

  const runtimesTable = child.stdout
  const runtimesTableRows = runtimesTable.split('\n').filter(Boolean)
  assert.strictEqual(runtimesTableRows.length, 3)

  const [headersRow, runtime1Row, runtime2Row] = runtimesTableRows

  const headers = headersRow.split(/\s+/).filter(Boolean)
  assert.deepStrictEqual(headers, [
    'PID', 'NAME', 'PLT', 'TIME', 'URL', 'PWD',
  ])

  const runtime1Values = runtime1Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(runtime1Values.length, 6)
  assert.strictEqual(runtime1Values[0], runtime1.pid.toString())
  assert.strictEqual(runtime1Values[1], 'runtime-1')
  assert.strictEqual(runtime1Values[2], version)
  assert.strictEqual(runtime1Values[4], runtime1Url)
  assert.strictEqual(runtime1Values[5], runtimeProjectDir1)

  const runtime2Values = runtime2Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(runtime2Values.length, 6)
  assert.strictEqual(runtime2Values[0], runtime2.pid.toString())
  assert.strictEqual(runtime2Values[1], 'runtime-2')
  assert.strictEqual(runtime2Values[2], version)
  assert.strictEqual(runtime2Values[4], runtime2Url)
  assert.strictEqual(runtime2Values[5], runtimeProjectDir2)
})

test('should remove the runtime tmp dir if can not get metadata', { skip: platform() === 'win32' }, async (t) => {
  const runtimeDir = join(PLATFORMATIC_TMP_DIR, '1234')
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(join(runtimeDir, 'socket'), '')

  const child = await execa('node', [cliPath, 'ps'])
  assert.strictEqual(child.exitCode, 0)

  try {
    await readdir(runtimeDir)
  } catch (error) {
    assert.strictEqual(error.code, 'ENOENT')
  }
})

test('should get no runtimes running', async (t) => {
  const child = await execa('node', [cliPath, 'ps'])
  assert.strictEqual(child.exitCode, 0)
  const runtimesTable = child.stdout
  assert.strictEqual(runtimesTable, 'No platformatic runtimes found.')

  {
    // This should work even if there is no /tmp/platformatic/runtimes directory
    await rm(PLATFORMATIC_TMP_DIR, { recursive: true, force: true }).catch(() => {})
    const child = await execa('node', [cliPath, 'ps'])
    assert.strictEqual(child.exitCode, 0)
    const runtimesTable = child.stdout
    assert.strictEqual(runtimesTable, 'No platformatic runtimes found.')
  }
})

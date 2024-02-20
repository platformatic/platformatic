'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'ps.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should close runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)

  t.after(() => {
    runtime.kill('SIGKILL')
  })

  const child = await execa('node', [cliPath, 'close', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Closed runtime "runtime-1".')

  const errorTimeout = async () => {
    await sleep(10000)
    throw new Error('Couldn\'t close runtime')
  }

  const runtimeExit = async () => {
    await runtime
    clearTimeout(errorTimeout)
    assert.strictEqual(runtime.exitCode, 0)
  }

  await Promise.race([errorTimeout(), runtimeExit()])
})

test('should close runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)

  t.after(() => {
    runtime.kill('SIGKILL')
  })

  const child = await execa('node', [cliPath, 'close', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Closed runtime "runtime-1".')

  const errorTimeout = async () => {
    await sleep(10000)
    throw new Error('Couldn\'t close runtime')
  }

  const runtimeExit = async () => {
    await runtime
    clearTimeout(errorTimeout)
    assert.strictEqual(runtime.exitCode, 0)
  }

  await Promise.race([errorTimeout(), runtimeExit()])
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'close', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

test('should throw if runtime name and pid are missing', async (t) => {
  const child = await execa('node', [cliPath, 'close'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
})

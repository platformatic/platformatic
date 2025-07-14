'use strict'

import { execa } from 'execa'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { startRuntime } from './helper.mjs'

const cliPath = join(import.meta.dirname, '..', 'control.js')
const fixturesDir = join(import.meta.dirname, 'fixtures')

test('should stop runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)

  const child = await execa('node', [cliPath, 'stop', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Stopped runtime "runtime-1".')

  let errorTimeout = null
  const timeoutPromise = new Promise((resolve, reject) => {
    errorTimeout = setTimeout(() => {
      reject(new Error('Couldn\'t stop runtime'))
    }, 15000)
  })

  const runtimeExit = async () => {
    await runtime
    clearTimeout(errorTimeout)
    assert.strictEqual(runtime.exitCode, 0)
  }

  await Promise.race([runtimeExit(), timeoutPromise])
})

test('should stop runtime by name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)

  const child = await execa('node', [cliPath, 'stop', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Stopped runtime "runtime-1".')

  let errorTimeout = null
  const timeoutPromise = new Promise((resolve, reject) => {
    errorTimeout = setTimeout(() => {
      reject(new Error('Couldn\'t stop runtime'))
    }, 15000)
  })

  const runtimeExit = async () => {
    await runtime
    clearTimeout(errorTimeout)
    assert.strictEqual(runtime.exitCode, 0)
  }

  await Promise.race([runtimeExit(), timeoutPromise])
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'stop', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

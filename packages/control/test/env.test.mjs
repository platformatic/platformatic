'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get runtime env by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile, { FOO: 'bar' })

  t.after(() => {
    return kill(runtime)
  })

  const child = await execa('node', [cliPath, 'env', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)
  assert.ok(child.stdout.includes('FOO=bar'))
})

test('should get runtime env by name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile, { FOO: 'bar' })

  t.after(() => {
    return kill(runtime)
  })

  const child = await execa('node', [cliPath, 'env', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)
  assert.ok(child.stdout.includes('FOO=bar'))
})

test('should use the runtime if there is only one', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile, { FOO: 'bar' })

  t.after(() => {
    return kill(runtime)
  })

  const child = await execa('node', [cliPath, 'env'])
  assert.strictEqual(child.exitCode, 0)
  assert.ok(child.stdout.includes('FOO=bar'))
})

test('should throw if runtime is missing', async () => {
  const child = await execa('node', [cliPath, 'env', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

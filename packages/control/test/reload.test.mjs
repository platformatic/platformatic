'use strict'

import * as desm from 'desm'
import { execa } from 'execa'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { startRuntime } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should reload the runtime by pid', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)

  const reload = await execa('node', [cliPath, 'reload', '-p', runtime.pid])
  const match = reload.stdout.match(/Reloaded runtime "runtime-1". The new PID is (\d+)/)
  assert.ok(match)

  process.kill(parseInt(match[1]), 'SIGINT')
})

test('should throw if runtime is missing', async t => {
  const child = await execa('node', [cliPath, 'reload', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

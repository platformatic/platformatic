'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should restart the runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  console.log('runtime pid', runtime.pid)
  t.after(() => kill(runtime))

  const child = execa('node', [cliPath, 'restart', '-p', runtime.pid])
  t.after(() => kill(child, 'SIGINT'))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  return new Promise((resolve) => {
    child.stdout.on('data', (data) => {
      if (data.toString().includes('Server listening at')) {
        clearTimeout(errorTimeout)
        resolve()
      }
    })
  })
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'restart', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

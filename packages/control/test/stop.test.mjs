'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import * as desm from 'desm'
import { execa } from 'execa'
import { buildServer } from '@platformatic/runtime'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should stop runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa('node', [cliPath, 'stop', '-p', process.pid])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Stopped runtime "runtime-1".')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should stop runtime by package name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa('node', [cliPath, 'stop', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Stopped runtime "runtime-1".')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'stop', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

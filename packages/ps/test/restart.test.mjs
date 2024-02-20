'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import * as desm from 'desm'
import { execa } from 'execa'
import { buildServer } from '@platformatic/runtime'

const cliPath = desm.join(import.meta.url, '..', 'ps.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should restart runtime by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa('node', [cliPath, 'restart', '-p', process.pid])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Restarted runtime "runtime-1".')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should restart runtime by package name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa('node', [cliPath, 'restart', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Restarted runtime "runtime-1".')

  {
    const serviceDetails = await app.getServiceDetails('service-1')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  {
    const serviceDetails = await app.getServiceDetails('service-2')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'restart', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

test('should throw if runtime name and pid are missing', async (t) => {
  const child = await execa('node', [cliPath, 'restart'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
})

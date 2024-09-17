'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get all runtime services by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configPath = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configPath)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'services', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)

  const runtimesTable = child.stdout
  const runtimesTableRows = runtimesTable.split('\n').filter(Boolean)
  assert.strictEqual(runtimesTableRows.length, 3)

  const [headersRow, service1Row, service2Row] = runtimesTableRows

  const headers = headersRow.split(/\s+/).filter(Boolean)
  assert.deepStrictEqual(headers, ['NAME', 'TYPE', 'ENTRYPOINT'])

  const service1Values = service1Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(service1Values.length, 3)
  assert.strictEqual(service1Values[0], 'service-1')
  assert.strictEqual(service1Values[1], 'service')
  assert.strictEqual(service1Values[2], 'yes')

  const service2Values = service2Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(service2Values.length, 3)
  assert.strictEqual(service2Values[0], 'service-2')
  assert.strictEqual(service2Values[1], 'service')
  assert.strictEqual(service2Values[2], 'no')
})

test('should get all runtime services by name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configPath = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configPath)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'services', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)

  const runtimesTable = child.stdout
  const runtimesTableRows = runtimesTable.split('\n').filter(Boolean)
  assert.strictEqual(runtimesTableRows.length, 3)

  const [headersRow, service1Row, service2Row] = runtimesTableRows

  const headers = headersRow.split(/\s+/).filter(Boolean)
  assert.deepStrictEqual(headers, ['NAME', 'TYPE', 'ENTRYPOINT'])

  const service1Values = service1Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(service1Values.length, 3)
  assert.strictEqual(service1Values[0], 'service-1')
  assert.strictEqual(service1Values[1], 'service')
  assert.strictEqual(service1Values[2], 'yes')

  const service2Values = service2Row.split(/\s+/).filter(Boolean)
  assert.strictEqual(service2Values.length, 3)
  assert.strictEqual(service2Values[0], 'service-2')
  assert.strictEqual(service2Values[1], 'service')
  assert.strictEqual(service2Values[2], 'no')
})

'use strict'

import * as desm from 'desm'
import { execa } from 'execa'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { getPlatformaticVersion, kill, startRuntime } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get runtime config by pid', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'config', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)

  const platformaticVersion = await getPlatformaticVersion()

  const runtimeConfig = JSON.parse(child.stdout)
  assert.strictEqual(
    runtimeConfig.$schema,
    `https://schemas.platformatic.dev/@platformatic/runtime/${platformaticVersion}.json`
  )
  assert.strictEqual(runtimeConfig.entrypoint, 'service-1')
  assert.strictEqual(runtimeConfig.watch, false)
  assert.deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: []
  })
  assert.deepStrictEqual(runtimeConfig.managementApi, true)
})

test('should get runtime config by name', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'config', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)

  const platformaticVersion = await getPlatformaticVersion()

  const runtimeConfig = JSON.parse(child.stdout)
  assert.strictEqual(
    runtimeConfig.$schema,
    `https://schemas.platformatic.dev/@platformatic/runtime/${platformaticVersion}.json`
  )
  assert.strictEqual(runtimeConfig.entrypoint, 'service-1')
  assert.strictEqual(runtimeConfig.watch, false)
  assert.deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: []
  })
  assert.deepStrictEqual(runtimeConfig.managementApi, true)
})

test('should get runtime service config', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'config', '-p', runtime.pid, '-s', 'service-1'])

  assert.strictEqual(child.exitCode, 0)

  const serviceConfig = JSON.parse(child.stdout)
  assert.deepStrictEqual(serviceConfig, {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      logger: { level: 'trace' }
    },
    service: { openapi: true },
    plugins: {
      paths: [join(projectDir, 'services', 'service-1', 'plugin.js')]
    },
    watch: { enabled: true },
    metrics: {
      defaultMetrics: {
        enabled: true
      },
      labels: {
        serviceId: 'service-1'
      },
      server: 'hide'
    }
  })
})

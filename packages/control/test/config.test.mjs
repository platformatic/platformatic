'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, getPlatformaticVersion } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should get runtime config by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGKILL'))

  const child = await execa('node', [cliPath, 'config', '-p', runtime.pid])
  assert.strictEqual(child.exitCode, 0)

  const platformaticVersion = await getPlatformaticVersion()

  const runtimeConfig = JSON.parse(child.stdout)
  assert.strictEqual(
    runtimeConfig.$schema,
    `https://platformatic.dev/schemas/v${platformaticVersion}/runtime`
  )
  assert.strictEqual(runtimeConfig.entrypoint, 'service-1')
  assert.strictEqual(runtimeConfig.hotReload, false)
  assert.deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: []
  })
  assert.deepStrictEqual(runtimeConfig.managementApi, true)
})

test('should get runtime config by name', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGKILL'))

  const child = await execa('node', [cliPath, 'config', '-n', 'runtime-1'])
  assert.strictEqual(child.exitCode, 0)

  const platformaticVersion = await getPlatformaticVersion()

  const runtimeConfig = JSON.parse(child.stdout)
  assert.strictEqual(
    runtimeConfig.$schema,
    `https://platformatic.dev/schemas/v${platformaticVersion}/runtime`
  )
  assert.strictEqual(runtimeConfig.entrypoint, 'service-1')
  assert.strictEqual(runtimeConfig.hotReload, false)
  assert.deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: []
  })
  assert.deepStrictEqual(runtimeConfig.managementApi, true)
})

test('should get runtime service config', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGKILL'))

  const child = await execa(
    'node', [cliPath, 'config', '-p', runtime.pid, '-s', 'service-1']
  )

  assert.strictEqual(child.exitCode, 0)

  const platformaticVersion = await getPlatformaticVersion()

  const serviceConfig = JSON.parse(child.stdout)
  assert.deepStrictEqual(serviceConfig, {
    $schema: `https://platformatic.dev/schemas/v${platformaticVersion}/service`,
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {},
      keepAliveTimeout: 5000
    },
    service: { openapi: true },
    plugins: {
      paths: [
        join(projectDir, 'services', 'service-1', 'plugin.js')
      ]
    },
    watch: { enabled: false },
    metrics: {
      defaultMetrics: {
        enabled: true
      },
      prefix: 'service_1_',
      server: 'hide'
    }
  })
})

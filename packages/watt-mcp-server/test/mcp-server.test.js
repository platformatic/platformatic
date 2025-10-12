'use strict'

import { test } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'
import {
  generateConfig,
  validateConfig,
  readWattConfig,
  writeWattConfig,
  addServiceToRuntime
} from '../index.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('generateConfig', async (t) => {
  await t.test('should generate a basic node config', async () => {
    const config = generateConfig({
      type: 'node',
      mainFile: 'server.js'
    })

    ok(config.$schema)
    ok(config.node)
    strictEqual(config.node.main, 'server.js')
    ok(config.logger)
    strictEqual(config.logger.level, 'info')
  })

  await t.test('should generate a service config with metrics', async () => {
    const config = generateConfig({
      type: 'service',
      port: 3000,
      includeMetrics: true,
      isStandalone: true
    })

    ok(config.service)
    ok(config.server)
    strictEqual(config.server.port, 3000)
    strictEqual(config.server.hostname, '0.0.0.0')
    ok(config.metrics)
    ok(config.metrics.defaultMetrics)
    strictEqual(config.metrics.defaultMetrics.enabled, true)
  })

  await t.test('should generate a service config without server when behind gateway', async () => {
    const config = generateConfig({
      type: 'service'
    })

    ok(config.service)
    strictEqual(config.server, undefined)
    ok(config.logger)
  })

  await t.test('should generate a db config', async () => {
    const config = generateConfig({
      type: 'db',
      port: 3001,
      isStandalone: true
    })

    ok(config.db)
    ok(config.db.connectionString)
    ok(config.server)
    strictEqual(config.server.port, 3001)
  })

  await t.test('should generate a db config without server when behind gateway', async () => {
    const config = generateConfig({
      type: 'db'
    })

    ok(config.db)
    ok(config.db.connectionString)
    strictEqual(config.server, undefined)
  })

  await t.test('should respect includeLogger option', async () => {
    const configWithLogger = generateConfig({ includeLogger: true })
    ok(configWithLogger.logger)

    const configWithoutLogger = generateConfig({ includeLogger: false })
    strictEqual(configWithoutLogger.logger, undefined)
  })
})

test('validateConfig', async (t) => {
  await t.test('should validate a valid runtime config with services', async () => {
    const validConfig = {
      services: [
        {
          id: 'api',
          path: './services/api'
        }
      ]
    }

    const validation = validateConfig(validConfig)
    strictEqual(validation.valid, true, `Config should be valid. Errors: ${JSON.stringify(validation.errors)}`)
    strictEqual(validation.errors.length, 0)
  })

  await t.test('should validate a valid runtime config with web', async () => {
    const validConfig = {
      web: [
        {
          id: 'frontend',
          path: './web/frontend',
          entrypoint: true
        }
      ]
    }

    const validation = validateConfig(validConfig)
    strictEqual(validation.valid, true, `Config should be valid. Errors: ${JSON.stringify(validation.errors)}`)
    strictEqual(validation.errors.length, 0)
  })

  await t.test('should detect invalid config', async () => {
    const invalidConfig = {
      // Missing required fields (needs autoload, applications, services, or web)
    }

    const validation = validateConfig(invalidConfig)
    strictEqual(validation.valid, false)
    ok(validation.errors.length > 0)
  })
})

test('writeWattConfig and readWattConfig', async (t) => {
  await t.test('should write and read JSON config files', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const testConfig = {
        node: {
          main: 'index.js'
        },
        logger: {
          level: 'debug'
        }
      }

      const writtenPath = await writeWattConfig(configPath, testConfig)
      ok(writtenPath)

      const { config, absolutePath } = await readWattConfig(configPath)
      deepStrictEqual(config, testConfig)
      ok(absolutePath)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should write and read YAML config files', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.yaml')
      const testConfig = {
        node: {
          main: 'index.js'
        }
      }

      await writeWattConfig(configPath, testConfig)
      const { config } = await readWattConfig(configPath)

      deepStrictEqual(config, testConfig)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})

test('addServiceToRuntime', async (t) => {
  await t.test('should add a service to empty runtime config', async () => {
    const runtimeConfig = {
      applications: []
    }

    const updated = addServiceToRuntime(runtimeConfig, {
      id: 'api',
      path: './services/api'
    })

    ok(updated.applications)
    strictEqual(updated.applications.length, 1)
    strictEqual(updated.applications[0].id, 'api')
    strictEqual(updated.applications[0].path, './services/api')
  })

  await t.test('should initialize applications array if missing', async () => {
    const runtimeConfig = {}

    const updated = addServiceToRuntime(runtimeConfig, {
      id: 'api',
      path: './services/api'
    })

    ok(updated.applications)
    strictEqual(updated.applications.length, 1)
  })

  await t.test('should update existing service', async () => {
    const runtimeConfig = {
      applications: [
        { id: 'api', path: './old-path' }
      ]
    }

    const updated = addServiceToRuntime(runtimeConfig, {
      id: 'api',
      path: './new-path'
    })

    strictEqual(updated.applications.length, 1)
    strictEqual(updated.applications[0].path, './new-path')
  })

  await t.test('should add service with config property', async () => {
    const runtimeConfig = { applications: [] }

    const updated = addServiceToRuntime(runtimeConfig, {
      id: 'api',
      config: './services/api/watt.json'
    })

    strictEqual(updated.applications[0].config, './services/api/watt.json')
  })
})

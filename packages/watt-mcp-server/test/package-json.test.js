'use strict'

import { test } from 'node:test'
import { ok, strictEqual } from 'node:assert'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  writeWattConfig,
  generateConfig,
  readOrCreatePackageJson,
  updatePackageJsonDependencies
} from '../index.js'

test('package.json management', async (t) => {
  await t.test('should create package.json when writing service config', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const config = generateConfig({ type: 'service', port: 3001 })

      // Simulate the write_watt_config tool behavior
      await writeWattConfig(configPath, config)

      // Call the package.json read logic
      const { packageJson } = await readOrCreatePackageJson(configPath)

      ok(packageJson)
      strictEqual(packageJson.name, 'watt-app')
      strictEqual(packageJson.type, 'module')
      ok(packageJson.scripts.start)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should add correct dependencies for node type', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      await updatePackageJsonDependencies(configPath, 'node')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/node'])
      // Should use version from package.json (^3.11.0)
      ok(packageJson.dependencies.wattpm.startsWith('^3.'))
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should add correct dependencies for service type', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      await updatePackageJsonDependencies(configPath, 'service')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/service'])
      ok(packageJson.dependencies.wattpm.startsWith('^3.'))
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should add correct dependencies for db type', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      await updatePackageJsonDependencies(configPath, 'db')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/db'])
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should add correct dependencies for gateway type', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      await updatePackageJsonDependencies(configPath, 'gateway')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/gateway'])
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should preserve other dependencies', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      // Create initial package.json with existing deps
      const initialPackageJson = {
        name: 'my-app',
        version: '2.0.0',
        dependencies: {
          lodash: '^4.17.21',
          axios: '^1.0.0'
        }
      }
      await writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2))

      await updatePackageJsonDependencies(configPath, 'service')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      // Should keep other deps
      strictEqual(packageJson.dependencies.lodash, '^4.17.21')
      strictEqual(packageJson.dependencies.axios, '^1.0.0')
      // Should add wattpm and @platformatic/service
      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/service'])
      // Should preserve name
      strictEqual(packageJson.name, 'my-app')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should add start script if missing', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      // Create package.json without start script
      const initialPackageJson = {
        name: 'my-app',
        version: '1.0.0',
        scripts: {},
        dependencies: {}
      }
      await writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2))

      const result = await updatePackageJsonDependencies(configPath, 'node')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      ok(packageJson.scripts)
      strictEqual(packageJson.scripts.start, 'watt start')
      ok(result.startScriptFixed)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should fix wrong start script', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      // Create package.json with wrong start script
      const initialPackageJson = {
        name: 'my-app',
        version: '1.0.0',
        scripts: {
          start: 'platformatic start',
          dev: 'nodemon server.js'
        },
        dependencies: {}
      }
      await writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2))

      const result = await updatePackageJsonDependencies(configPath, 'node')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      // Should fix start script
      strictEqual(packageJson.scripts.start, 'watt start')
      ok(result.startScriptFixed)
      // Should keep other scripts
      strictEqual(packageJson.scripts.dev, 'nodemon server.js')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  await t.test('should fix wrong dependencies and versions', async () => {
    const testDir = join(tmpdir(), `watt-mcp-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    try {
      const configPath = join(testDir, 'watt.json')
      const packageJsonPath = join(testDir, 'package.json')

      // Create package.json with wrong dependencies
      const initialPackageJson = {
        name: 'my-app',
        version: '1.0.0',
        scripts: {
          start: 'platformatic start'
        },
        dependencies: {
          '@platformatic/service': '^2.0.0',
          '@platformatic/gateway': '^2.0.0',
          fastify: '^5.0.0'
        },
        devDependencies: {
          platformatic: '^2.0.0'
        }
      }
      await writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2))

      const result = await updatePackageJsonDependencies(configPath, 'service')

      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      // Should have correct dependencies
      ok(packageJson.dependencies.wattpm)
      ok(packageJson.dependencies['@platformatic/service'])
      ok(packageJson.dependencies['@platformatic/service'].startsWith('^3.'))

      // Should remove fastify and old platformatic
      strictEqual(packageJson.dependencies.fastify, undefined)
      strictEqual(packageJson.dependencies.platformatic, undefined)
      strictEqual(packageJson.devDependencies?.platformatic, undefined)

      // Should fix start script
      strictEqual(packageJson.scripts.start, 'watt start')
      ok(result.startScriptFixed)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})

'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadServicesCommands } = require('../index.js')
const { createDirectory, safeRemove } = require('@platformatic/foundation')
const { writeFile } = require('node:fs/promises')

async function createTmpDir (t) {
  const originalCwd = process.cwd()
  const tmpDir = `/tmp/test-${Date.now()}-${Math.random()}`

  await createDirectory(tmpDir, true)
  process.chdir(tmpDir)

  t.after(async () => {
    process.chdir(originalCwd)
    await safeRemove(tmpDir)
  })

  return tmpDir
}

test('loadServicesCommands returns empty objects when no runtime config found', async (t) => {
  await createTmpDir(t)

  const result = await loadServicesCommands()

  assert.deepStrictEqual(result, {
    services: {},
    commands: {},
    help: {}
  })
})

test('loadServicesCommands returns empty objects when runtime config has no services', async (t) => {
  const tmpDir = await createTmpDir(t)

  await writeFile(join(tmpDir, 'platformatic.json'), JSON.stringify({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
    autoload: {
      path: './services',
      exclude: []
    },
    services: []
  }, null, 2))

  const result = await loadServicesCommands()

  assert.deepStrictEqual(result, {
    services: {},
    commands: {},
    help: {}
  })
})

test('loadServicesCommands returns empty objects when services have no createCommands', async (t) => {
  const tmpDir = await createTmpDir(t)

  await writeFile(join(tmpDir, 'platformatic.json'), JSON.stringify({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
    services: [
      {
        id: 'test-service',
        path: './services/test-service',
        config: 'platformatic.json'
      }
    ]
  }, null, 2))

  // Create a service directory but no actual service files
  // This will cause the service to fail to load and be ignored
  const result = await loadServicesCommands()

  assert.deepStrictEqual(result, {
    services: {},
    commands: {},
    help: {}
  })
})

test('loadServicesCommands ignores services that fail to load', async (t) => {
  const tmpDir = await createTmpDir(t)

  await writeFile(join(tmpDir, 'platformatic.json'), JSON.stringify({
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
    services: [
      {
        id: 'nonexistent-service',
        path: './services/nonexistent',
        config: 'platformatic.json'
      }
    ]
  }, null, 2))

  const result = await loadServicesCommands()

  assert.deepStrictEqual(result, {
    services: {},
    commands: {},
    help: {}
  })
})

test('loadServicesCommands works with existing fixtures that have commands', async (t) => {
  const originalCwd = process.cwd()
  const fixtureDir = join(__dirname, '..', 'fixtures', 'metrics')

  t.after(() => {
    process.chdir(originalCwd)
  })

  process.chdir(fixtureDir)

  const result = await loadServicesCommands()

  // Verify the structure
  assert.ok(typeof result === 'object')
  assert.ok(typeof result.services === 'object')
  assert.ok(typeof result.commands === 'object')
  assert.ok(typeof result.help === 'object')

  // The metrics fixture should have commands from service-db (DB package) and service-1 (Composer package)
  const serviceKeys = Object.keys(result.services)
  const helpKeys = Object.keys(result.help)

  // Verify we have some commands
  assert.ok(serviceKeys.length > 0, 'Should have found some service commands')
  assert.ok(helpKeys.length > 0, 'Should have found some help entries')

  // Verify that service keys match help keys
  assert.deepStrictEqual(serviceKeys.sort(), helpKeys.sort())

  // Verify that we have the expected DB commands
  const dbCommands = serviceKeys.filter(key => key.startsWith('service-db:'))
  assert.ok(dbCommands.length > 0, 'Should have found DB service commands')

  // Verify specific expected DB commands
  const expectedDbCommands = [
    'service-db:migrations:create',
    'service-db:migrations:apply',
    'service-db:seed',
    'service-db:types',
    'service-db:schema'
  ]

  for (const expectedCommand of expectedDbCommands) {
    assert.ok(serviceKeys.includes(expectedCommand), `Should include command: ${expectedCommand}`)
    assert.ok(result.help[expectedCommand], `Should have help for command: ${expectedCommand}`)
    assert.strictEqual(result.services[expectedCommand].id, 'service-db')
  }

  // Verify we have composer commands
  const composerCommands = serviceKeys.filter(key => key.startsWith('service-1:'))
  assert.ok(composerCommands.length > 0, 'Should have found Composer service commands')
  assert.ok(composerCommands.includes('service-1:fetch-openapi-schemas'))
})

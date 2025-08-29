import { createDirectory, safeRemove } from '@platformatic/foundation'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadApplicationsCommands } from '../index.js'

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

test('loadApplicationsCommands returns empty objects when no runtime config found', async t => {
  await createTmpDir(t)

  const result = await loadApplicationsCommands()

  deepStrictEqual(result, {
    applications: {},
    commands: {},
    help: {}
  })
})

test('loadApplicationsCommands returns empty objects when runtime config has no applications', async t => {
  const tmpDir = await createTmpDir(t)

  await writeFile(
    join(tmpDir, 'platformatic.json'),
    JSON.stringify(
      {
        $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
        autoload: {
          path: './applications',
          exclude: []
        },
        applications: []
      },
      null,
      2
    )
  )

  const result = await loadApplicationsCommands()

  deepStrictEqual(result, {
    applications: {},
    commands: {},
    help: {}
  })
})

test('loadApplicationsCommands returns empty objects when applications have no createCommands', async t => {
  const tmpDir = await createTmpDir(t)

  await writeFile(
    join(tmpDir, 'platformatic.json'),
    JSON.stringify(
      {
        $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
        applications: [
          {
            id: 'test-service',
            path: './applications/test-service',
            config: 'platformatic.json'
          }
        ]
      },
      null,
      2
    )
  )

  // Create an application directory but no actual application files
  // This will cause the application to fail to load and be ignored
  const result = await loadApplicationsCommands()

  deepStrictEqual(result, {
    applications: {},
    commands: {},
    help: {}
  })
})

test('loadApplicationsCommands ignores applications that fail to load', async t => {
  const tmpDir = await createTmpDir(t)

  await writeFile(
    join(tmpDir, 'platformatic.json'),
    JSON.stringify(
      {
        $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.65.1.json',
        applications: [
          {
            id: 'nonexistent-service',
            path: './services/nonexistent',
            config: 'platformatic.json'
          }
        ]
      },
      null,
      2
    )
  )

  const result = await loadApplicationsCommands()

  deepStrictEqual(result, {
    applications: {},
    commands: {},
    help: {}
  })
})

test('loadApplicationsCommands works with existing fixtures that have commands', async t => {
  const originalCwd = process.cwd()
  const fixtureDir = join(import.meta.dirname, '..', 'fixtures', 'metrics')

  t.after(() => {
    process.chdir(originalCwd)
  })

  process.chdir(fixtureDir)

  const result = await loadApplicationsCommands()

  // Verify the structure
  ok(typeof result === 'object')
  ok(typeof result.applications === 'object')
  ok(typeof result.commands === 'object')
  ok(typeof result.help === 'object')

  // The metrics fixture should have commands from service-db (DB package) and service-1 (Gateway package)
  const applicationKeys = Object.keys(result.applications)
  const helpKeys = Object.keys(result.help)

  // Verify we have some commands
  ok(applicationKeys.length > 0, 'Should have found some application commands')
  ok(helpKeys.length > 0, 'Should have found some help entries')

  // Verify that application keys match help keys
  deepStrictEqual(applicationKeys.sort(), helpKeys.sort())

  // Verify that we have the expected DB commands
  const dbCommands = applicationKeys.filter(key => key.startsWith('service-db:'))
  ok(dbCommands.length > 0, 'Should have found DB application commands')

  // Verify specific expected DB commands
  const expectedDbCommands = [
    'service-db:migrations:create',
    'service-db:migrations:apply',
    'service-db:seed',
    'service-db:types',
    'service-db:schema'
  ]

  for (const expectedCommand of expectedDbCommands) {
    ok(applicationKeys.includes(expectedCommand), `Should include command: ${expectedCommand}`)
    ok(result.help[expectedCommand], `Should have help for command: ${expectedCommand}`)
    strictEqual(result.applications[expectedCommand].id, 'service-db')
  }

  // Verify we have gateway commands
  const gatewayCommands = applicationKeys.filter(key => key.startsWith('service-1:'))
  ok(gatewayCommands.length > 0, 'Should have found Gateway application commands')
  ok(gatewayCommands.includes('service-1:fetch-openapi-schemas'))
})

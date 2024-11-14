import { execa } from 'execa'
import assert from 'node:assert/strict'
import { cp, mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cliPath } from './helper.js'

test('resolve runtime external services', async t => {
  const dest = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-resolve'), dest, {
    recursive: true
  })

  const child = await execa('node', [cliPath, 'resolve', '--test'], { cwd: dest })

  assert.ok(!child.stdout.includes('piquant-combat'), child.stdout)
  assert.ok(child.stdout.includes('Skipping service piquant-existing as the path already exists'), child.stdout)
  assert.ok(
    child.stdout.includes(
      'Skipping service piquant-resolved as the generated path external/piquant-resolved already exists'
    ),
    child.stdout
  )

  assert.ok(
    child.stdout.includes(
      `Skipping service external-service-4 as the non existent directory ${resolve(await realpath(dest), '../non-existent')} is outside the project directory`
    ),
    child.stdout
  )

  assert.ok(
    child.stdout.includes('Cloning http://github.com/test-owner/test-app-1.git into services/external-service-1'),
    child.stdout
  )

  assert.ok(
    child.stdout.includes(
      `Cloning http://github.com/test-owner/test-app-1.git into ${join('external', 'without-path')}`
    ),
    child.stdout
  )

  assert.ok(
    child.stdout.includes(
      `Cloning http://github.com/test-owner/test-app-2.git into ${join('custom-external', 'external-service-2')}`
    ),
    child.stdout
  )

  assert.ok(
    child.stdout.includes(
      `Cloning http://github.com/test-owner/test-app-3.git into ${join('external', 'external-service-3')}`
    ),
    child.stdout
  )

  assert.ok(child.stdout.includes('Resolving dependencies for service "external-service-1"'), child.stdout)
  assert.ok(child.stdout.includes('Resolving dependencies for service "external-service-2"'), child.stdout)
  assert.ok(child.stdout.includes('Resolving dependencies for service "external-service-3"'), child.stdout)

  assert.ok(child.stdout.includes('All external services have been resolved'), child.stdout)
})

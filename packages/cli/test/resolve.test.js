import { safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { cp, mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { prepareGitRepository } from '../../wattpm/test/helper.js'
import { cliPath } from './helper.js'

test('resolve runtime external services', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/runtime-resolve'), rootDir, { recursive: true })
  const repoUrl = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  const child = await execa('node', [cliPath, 'resolve'], { cwd: rootDir, env: { NO_COLOR: 'true' } })

  assert.ok(!child.stdout.includes('piquant-combat'), child.stdout)
  assert.ok(child.stdout.includes('Skipping service piquant-existing as the path already exists'), child.stdout)
  assert.ok(
    child.stdout.includes(
      `Skipping service piquant-resolved as the generated path external${sep}piquant-resolved already exists`
    ),
    child.stdout
  )

  assert.ok(
    child.stdout.includes(
      `Skipping service external-service-4 as the non existent directory ${resolve(await realpath(rootDir), '../non-existent')} is outside the project directory`
    ),
    child.stdout
  )

  assert.ok(child.stdout.includes(`Cloning ${repoUrl} into services${sep}external-service-1`), child.stdout)

  assert.ok(child.stdout.includes(`Cloning ${repoUrl} into ${join('external', 'without-path')}`), child.stdout)

  assert.ok(
    child.stdout.includes(`Cloning ${repoUrl} into ${join('custom-external', 'external-service-2')}`),
    child.stdout
  )

  assert.ok(child.stdout.includes(`Cloning ${repoUrl} into ${join('external', 'external-service-3')}`), child.stdout)

  assert.ok(child.stdout.includes('Installing dependencies for service external-service-1'), child.stdout)
  assert.ok(child.stdout.includes('Installing dependencies for service external-service-2'), child.stdout)
  assert.ok(child.stdout.includes('Installing dependencies for service external-service-3'), child.stdout)

  assert.ok(child.stdout.includes('All external services have been resolved'), child.stdout)
})

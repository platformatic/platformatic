import { safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { appendFile, cp, mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cliPath } from './helper.js'

test('resolve runtime external services', async t => {
  const current = dirname(fileURLToPath(import.meta.url))
  const dest = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  const repo = await mkdtemp(join(tmpdir(), `test-repo-${process.pid}-`))

  await cp(resolve(current, 'fixtures/runtime-resolve'), dest, { recursive: true })
  await cp(resolve(current, '../../wattpm/test/fixtures/external-repo'), repo, { recursive: true })

  await execa('git', ['init'], { cwd: repo })
  await execa('git', ['add', '-A'], { cwd: repo })
  await execa('git', ['commit', '-n', '-m', 'Initial commit.'], { cwd: repo })

  t.after(async () => {
    await safeRemove(dest)
    await safeRemove(repo)
  })

  const repoUrl = pathToFileURL(repo).toString()
  await appendFile(resolve(dest, '.env'), `\nPLT_GIT_REPO_URL=${repoUrl}\n`, 'utf8')

  const child = await execa('node', [cliPath, 'resolve'], { cwd: dest, env: { NO_COLOR: 'true' } })

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

  assert.ok(child.stdout.includes(`Cloning ${repoUrl} into services/external-service-1`), child.stdout)

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

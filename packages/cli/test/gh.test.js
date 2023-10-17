import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { execa } from 'execa'
import { cliPath } from './helper.js'
import { fileURLToPath } from 'url'
import mkdirp from 'mkdirp'

let count = 0

test('creates a deploy config for static workspace', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'gh'], {
    cwd: dest
  })

  const deployWorkflow = await readFile(join(dest, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml'), 'utf8')
  assert.ok(deployWorkflow.indexOf('PLATFORMATIC_STATIC_WORKSPACE_ID') !== -1)
  assert.ok(deployWorkflow.indexOf('PLATFORMATIC_STATIC_WORKSPACE_API_KEY') !== -1)
})

test('creates a deploy config for dynamic workspace', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'gh', '-t', 'dynamic'], {
    cwd: dest
  })

  const deployWorkflow = await readFile(join(dest, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml'), 'utf8')
  assert.ok(deployWorkflow.indexOf('PLATFORMATIC_DYNAMIC_WORKSPACE_ID') !== -1)
  assert.ok(deployWorkflow.indexOf('PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY') !== -1)
})

test('creation fails if workspace type is not static or dynamic', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  try {
    await execa('node', [cliPath, 'gh', '-t', 'XXXXX'], {
      cwd: dest
    })
    assert.fail('should have failed')
  } catch ({ stdout }) {
    assert.ok(stdout.indexOf('Type must be either static or dynamic') !== -1)
  }
})

test('creation fails if no config file is found', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)
  await mkdirp(dest)
  try {
    await execa('node', [cliPath, 'gh'], {
      cwd: dest
    })
    assert.fail('should have failed')
  } catch ({ stdout }) {
    assert.ok(stdout.indexOf('No config file found') !== -1)
  }
})

test('creates a deploy must warn that a .env exists', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await writeFile(join(dest, '.env'), 'TEST=1')

  const { stdout } = await execa('node', [cliPath, 'gh'], {
    cwd: dest
  })
  assert.ok(stdout.indexOf('Found .env file') !== -1)
})

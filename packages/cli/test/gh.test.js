import { test } from 'tap'
import { tmpdir } from 'os'
import { execa } from 'execa'
import { cp, readFile, writeFile } from 'fs/promises'
import { cliPath } from './helper.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mkdirp from 'mkdirp'

let count = 0
const workspaceId = 'WORKSPACE-ID-TEST'

test('creates a deploy config for static workspace', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  t.comment(`working in ${dest}`)
  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'gh', '-w', workspaceId], {
    cwd: dest
  })

  const deployWorkflow = await readFile(join(dest, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml'), 'utf8')
  t.ok(deployWorkflow.indexOf('PLATFORMATIC_STATIC_WORKSPACE_API_KEY') !== -1)
  t.ok(deployWorkflow.indexOf('WORKSPACE-ID-TEST') !== -1)
})

test('creates a deploy config for dynamic workspace', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'gh', '-w', workspaceId, '-t', 'dynamic'], {
    cwd: dest
  })

  const deployWorkflow = await readFile(join(dest, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml'), 'utf8')
  t.ok(deployWorkflow.indexOf('PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY') !== -1)
  t.ok(deployWorkflow.indexOf('WORKSPACE-ID-TEST') !== -1)
})

test('creation fails if workspace is missing', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  try {
    await execa('node', [cliPath, 'gh'], {
      cwd: dest
    })
    t.fail('should have failed')
  } catch ({ stdout }) {
    t.ok(stdout.indexOf('Workspace ID is required') !== -1)
  }
})

test('creation fails if workspace type is not static or dynamic', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  try {
    await execa('node', [cliPath, 'gh', '-w', workspaceId, '-t', 'XXXXX'], {
      cwd: dest
    })
    t.fail('should have failed')
  } catch ({ stdout }) {
    t.ok(stdout.indexOf('Type must be either static or dynamic') !== -1)
  }
})

test('creation fails if no config file is found', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)
  await mkdirp(dest)
  try {
    await execa('node', [cliPath, 'gh', '-w', workspaceId], {
      cwd: dest
    })
    t.fail('should have failed')
  } catch ({ stdout }) {
    t.ok(stdout.indexOf('No config file found') !== -1)
  }
})

test('creates a deploy must warn that a .env exists', async (t) => {
  const dest = join(tmpdir(), `test-cli-gh-${process.pid}-${count++}`)

  await mkdirp(dest)
  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await writeFile(join(dest, '.env'), 'TEST=1')

  const { stdout } = await execa('node', [cliPath, 'gh', '-w', workspaceId], {
    cwd: dest
  })
  t.ok(stdout.indexOf('Found .env file') !== -1)
})

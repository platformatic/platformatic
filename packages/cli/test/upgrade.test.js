import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { cp, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cliPath } from './helper.js'
import { mkdirp } from 'mkdirp'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

let count = 0

/* eslint-disable prefer-regex-literals */

test('writes a config file', async t => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json')
  )

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.db.schema.json'),
    join(dest, 'platformatic.db.schema.json')
  )

  await createDirectory(join(dest, 'node_modules', '@platformatic'))

  await symlink(join(rootDir, 'node_modules', '@platformatic', 'db'), join(dest, 'node_modules', '@platformatic', 'db'))

  const { stdout } = await execa('node', [cliPath, 'upgrade'], {
    cwd: dest,
  })

  assert.match(stdout, /Migrating to version 0.16.0/)
  assert.match(stdout, /Migrating to version 0.18.0/)
  assert.match(stdout, /Migrating to version 0.28.0/)

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  assert.match(
    config.$schema,
    new RegExp('https://schemas.platformatic.dev/@platformatic/db/\\d+.\\d+.\\d+(?:-\\w+\\.\\d+)?\\.json')
  )
})

test('writes a config file with a config option', async t => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json')
  )

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.db.schema.json'),
    join(dest, 'platformatic.db.schema.json')
  )

  await createDirectory(join(dest, 'node_modules', '@platformatic'))

  await symlink(join(rootDir, 'node_modules', '@platformatic', 'db'), join(dest, 'node_modules', '@platformatic', 'db'))

  await execa('node', [cliPath, 'upgrade', '-c', join(dest, 'platformatic.db.json')], {
    cwd: dest,
  })

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  assert.match(
    config.$schema,
    new RegExp('https://schemas.platformatic.dev/@platformatic/db/\\d+.\\d+.\\d+(?:-\\w+\\.\\d+)?\\.json')
  )
})

test('no config file no party', async t => {
  await assert.rejects(execa('node', [cliPath, 'upgrade']))
})

test('updates a runtime', async t => {
  const dest = join(import.meta.url, '..', 'tmp', `test-cli-${process.pid}-${count++}`)
  t.after(async () => {
    await safeRemove(dest)
  })
  await mkdirp(fileURLToPath(dest))

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-upgrade'), dest, {
    recursive: true,
  })

  await execa('node', [cliPath, 'upgrade'], {
    cwd: dest,
  })

  const config = JSON.parse(await readFile(join(dest, 'platformatic.json'), 'utf8'))

  assert.match(
    config.$schema,
    new RegExp('https://schemas.platformatic.dev/@platformatic/runtime/\\d+.\\d+.\\d+(?:-\\w+\\.\\d+)?\\.json')
  )
})

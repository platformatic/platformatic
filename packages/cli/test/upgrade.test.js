import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cp, readFile } from 'node:fs/promises'
import { execa } from 'execa'
import { cliPath } from './helper.js'

let count = 0

/* eslint-disable prefer-regex-literals */

test('writes a config file', async (t) => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.db.schema.json'),
    join(dest, 'platformatic.db.schema.json'))

  const { stdout } = await execa('node', [cliPath, 'upgrade'], {
    cwd: dest
  })

  assert.match(stdout, /Migrating to version 0.16.0/)
  assert.match(stdout, /Migrating to version 0.18.0/)
  assert.match(stdout, /Migrating to version 0.28.0/)

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  assert.match(config.$schema, new RegExp('https://platformatic.dev/schemas/v\\d+.\\d+.\\d+/db'))
})

test('writes a config file with a config option', async (t) => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.db.schema.json'),
    join(dest, 'platformatic.db.schema.json'))

  await execa('node', [cliPath, 'upgrade', '-c', join(dest, 'platformatic.db.json')])

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  assert.match(config.$schema, new RegExp('https://platformatic.dev/schemas/v\\d+.\\d+.\\d+/db'))
})

test('no config file no party', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'upgrade']))
})

test('updates a runtime', async (t) => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'runtime-upgrade'),
    dest,
    { recursive: true })

  await execa('node', [cliPath, 'upgrade'], {
    cwd: dest
  })

  const config = JSON.parse(await readFile(join(dest, 'platformatic.json'), 'utf8'))

  assert.match(config.$schema, new RegExp('https://platformatic.dev/schemas/v\\d+.\\d+.\\d+/runtime'))
})

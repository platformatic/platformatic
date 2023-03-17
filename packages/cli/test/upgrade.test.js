import { test } from 'tap'
import { tmpdir } from 'os'
import { execa } from 'execa'
import { cp, readFile } from 'fs/promises'
import { cliPath } from './helper.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

let count = 0

/* eslint-disable prefer-regex-literals */

test('writes a config file', async (t) => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'upgrade'], {
    cwd: dest
  })

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  t.match(config.$schema, new RegExp('https://platformatic.dev/schemas/v\\d+.\\d+.\\d+/db'))
})

test('writes a config file with a config option', async (t) => {
  const dest = join(tmpdir(), `test-cli-${process.pid}-${count++}`)

  await cp(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.16.0.db.json'),
    join(dest, 'platformatic.db.json'))

  await execa('node', [cliPath, 'upgrade', '-c', join(dest, 'platformatic.db.json')])

  const config = JSON.parse(await readFile(join(dest, 'platformatic.db.json'), 'utf8'))

  t.match(config.$schema, new RegExp('https://platformatic.dev/schemas/v\\d+.\\d+.\\d+/db'))
})

test('no config file no party', async (t) => {
  await t.rejects(execa('node', [cliPath, 'upgrade']))
})

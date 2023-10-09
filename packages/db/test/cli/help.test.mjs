import assert from 'node:assert/strict'
import { EOL } from 'node:os'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { execa } from 'execa'
import { join } from 'desm'
import { cliPath } from './helper.js'

const CLI_COMMANDS = [
  'types',
  'start',
  'compile',
  'seed',
  'schema',
  'migrations',
  'migrations create',
  'migrations apply'
]

for (const cmd of CLI_COMMANDS) {
  test(`db help ${cmd}`, async (t) => {
    const { stdout } = await execa('node', [cliPath, 'help', cmd])
    const path = join(import.meta.url, '..', '..', 'help', `${cmd}.txt`)
    assert.equal(stdout + EOL, await readFile(path, 'utf8'))
  })
}

test('db help foobar', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help', 'foobar'])
  assert.ok(stdout.includes('no such help file: foobar'))
})

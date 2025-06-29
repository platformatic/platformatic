import { join } from 'desm'
import { execa } from 'execa'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { cliPath, startPath } from './helper.mjs'

const version = JSON.parse(await readFile(join(import.meta.url, '..', '..', 'package.json'), 'utf-8')).version

test('version', async t => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  assert.ok(stdout.includes('v' + version))
})

test('missing config', async t => {
  await assert.rejects(execa('node', [startPath]))
})

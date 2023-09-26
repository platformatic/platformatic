import assert from 'node:assert'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'desm'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import { cliPath } from './helper.mjs'

const version = JSON.parse(await readFile(join(import.meta.url, '..', '..', 'package.json'))).version

test('version', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  assert.ok(stdout.includes('v' + version))
})

test('missing config', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'start']))
})

// Skipping because now we don't have any required property in service schema
test('print validation errors', { skip: true }, async () => {
  try {
    await execa('node', [cliPath, 'start', '--config', join(import.meta.url, '..', 'fixtures', 'missing-property.config.json')])
    assert.fail('should have failed')
  } catch (err) {
    assert.strictEqual(err.exitCode, 1)
    assert.strictEqual(stripAnsi(err.stdout), `
┌─────────┬──────┬─────────────────────────────────────────────────────────────────────┐
│ (index) │ path │                               message                               │
├─────────┼──────┼─────────────────────────────────────────────────────────────────────┤
│    0    │ '/'  │ \`must have required property 'server' {"missingProperty":"server"}\` │
└─────────┴──────┴─────────────────────────────────────────────────────────────────────┘
`.trim())
  }
})

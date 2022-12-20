import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { readFile } from 'fs/promises'
import { execa } from 'execa'

const version = JSON.parse(await readFile(join(import.meta.url, '..', '..', 'package.json'))).version

test('version', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  t.ok(stdout.includes('v' + version))
})

test('missing config', async (t) => {
  await t.rejects(execa('node', [cliPath, 'start']))
})

test('print validation errors', async ({ equal, plan }) => {
  plan(2)
  try {
    await execa('node', [cliPath, 'start', '--config', join(import.meta.url, '..', 'fixtures', 'missing-property.config.json')])
  } catch (err) {
    equal(err.exitCode, 1)
    equal(err.stdout, `
┌─────────┬──────┬─────────────────────────────────────────────────────────────────────┐
│ (index) │ path │                               message                               │
├─────────┼──────┼─────────────────────────────────────────────────────────────────────┤
│    0    │ '/'  │ \`must have required property 'server' {"missingProperty":"server"}\` │
└─────────┴──────┴─────────────────────────────────────────────────────────────────────┘
`.trim())
  }
})

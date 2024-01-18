import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'desm'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import { getConnectionInfo } from '../helper.js'
import { cliPath } from './helper.js'

const version = JSON.parse(await readFile(join(import.meta.url, '..', '..', 'package.json'))).version

test('version', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  assert.ok(stdout.includes('v' + version))
})

test('missing config', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'start']))
})

test('print validation errors', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  try {
    await execa(
      'node', [cliPath, 'start', '--config', join(import.meta.url, '..', 'fixtures', 'missing-required-values.json')],
      {
        env: {
          DATABASE_URL: connectionInfo.connectionString
        }
      }
    )
    assert.fail('should have thrown')
  } catch (err) {
    assert.equal(err.exitCode, 1)
    assert.equal(stripAnsi(err.stdout).includes('must have required property \'dir\' {"missingProperty":"dir"}'), true)
  }
})

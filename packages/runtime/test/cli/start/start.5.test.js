import { execa } from 'execa'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { startPath } from '../helper.js'

test('exits without starting if there are no applications', async t => {
  const config = join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'configs',
    'no-services-no-entrypoint.config.json'
  )
  const child = execa(process.execPath, [startPath, config], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
  const result = await child

  assert.strictEqual(result.exitCode, 0)
  assert.strictEqual(result.stdout, '')
  assert.strictEqual(result.stderr, '')
})

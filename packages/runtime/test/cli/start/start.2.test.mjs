import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { start } from '../helper.mjs'

test('use runtime server', async () => {
  const config = join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'server',
    'runtime-server',
    'platformatic.runtime.json'
  )
  const { child, url } = await start(config, { env: { PLT_USE_PLAIN_CREATE: 'true' } })
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGKILL')
  await child.catch(() => {})
})

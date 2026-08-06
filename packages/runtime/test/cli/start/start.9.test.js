import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { start } from '../helper.js'

test('the application uses its own server configuration', async () => {
  const config = join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'server',
    'overrides-service',
    'platformatic.runtime.json'
  )
  const { child, url } = await start(config, { env: { PLT_USE_PLAIN_CREATE: 'true' } })
  assert.strictEqual(url, 'http://127.0.0.1:14343')
  child.kill('SIGKILL')
})

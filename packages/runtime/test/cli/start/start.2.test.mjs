import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { start } from '../helper.mjs'

test('use runtime server', async () => {
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGKILL')
  await child.catch(() => {})
})

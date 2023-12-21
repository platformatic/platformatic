import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { start } from '../helper.mjs'

test('the runtime server overrides the entrypoint server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'overrides-service', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
})

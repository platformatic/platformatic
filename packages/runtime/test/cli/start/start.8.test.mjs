import { join } from 'desm'
import assert from 'node:assert'
import { test } from 'node:test'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('stackable', async () => {
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  const { child, url } = await start(config)
  const res = await request(url + '/foo')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  child.kill('SIGKILL')
  await child.catch(() => {})
})

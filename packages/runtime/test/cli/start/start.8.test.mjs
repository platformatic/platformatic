import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('stackable', async () => {
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/foo')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  child.kill('SIGINT')
  await child.catch(() => {})
})

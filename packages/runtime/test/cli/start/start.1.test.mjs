import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('autostart', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('-c', config)
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGINT')
  await child.catch(() => {})
})

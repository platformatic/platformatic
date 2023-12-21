import assert from 'node:assert'
import { once } from 'node:events'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('handles uncaughtException', async (t) => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'dbApp', 'platformatic.db.json')
  const { child, url } = await start('-c', config)

  t.after(async () => {
    child.kill('SIGINT')
  })
  const res = await request(url + '/async_crash')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'ok')

  const [code] = await once(child, 'exit')
  assert.strictEqual(code, 1)
})

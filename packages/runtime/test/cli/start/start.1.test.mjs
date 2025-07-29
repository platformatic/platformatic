import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('autostart', async () => {
  const config = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start(config)
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGKILL')
  await child.catch(() => {})
})

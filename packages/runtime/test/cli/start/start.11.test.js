import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { start } from '../helper.js'

test('start command', async t => {
  const config = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start(config, { applicationId: 'serviceApp', env: { PLT_USE_PLAIN_CREATE: 'true' } })
  t.after(async () => {
    child.kill('SIGINT')
    await child.catch(() => {})
  })
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
})

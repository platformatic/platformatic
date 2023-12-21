import assert from 'node:assert'
import { once } from 'node:events'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('exits on error', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/crash')
  const [exitCode] = await once(child, 'exit')

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(exitCode, 1)
})

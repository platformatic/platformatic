import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('do not reach for dns if plt.local fail to resolve', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    // Basic URL on the entrypoint.
    const res = await request(entryUrl + '/unknown')

    strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    ok(body.msg.match(/No target found for unknown.plt.local in thread \d./), [body.msg])
  }
})

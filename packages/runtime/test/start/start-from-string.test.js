import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('can start applications programmatically from string', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    // Basic URL on the entrypoint.
    const res = await request(entryUrl)

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  }

  {
    // URL on the entrypoint that uses internal message passing.
    const res = await request(entryUrl + '/upstream')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
})

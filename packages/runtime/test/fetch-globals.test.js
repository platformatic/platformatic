import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('fetch globals should work with both string URL and Request object', async t => {
  const configFile = join(fixturesDir, 'fetch-globals', 'platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.init()
  const entryUrl = await app.start()

  // Test fetch with string URL
  {
    const { statusCode, body } = await request(entryUrl, { path: '/fetch-string' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    strictEqual(response.method, 'string')
    strictEqual(response.ok, true)
    deepStrictEqual(response.data, { message: 'hello from backend' })
  }

  // Test fetch with Request object - this was failing before the fix
  {
    const { statusCode, body } = await request(entryUrl, { path: '/fetch-request' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    strictEqual(response.method, 'request')
    strictEqual(response.ok, true)
    deepStrictEqual(response.data, { message: 'hello from backend' })
  }

  // Verify globals are properly set
  {
    const { statusCode, body } = await request(entryUrl, { path: '/check-globals' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, {
      hasRequest: true,
      hasResponse: true,
      hasFetch: true
    })
  }
})

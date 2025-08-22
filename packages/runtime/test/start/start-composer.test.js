import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  {
    const res = await request(entryUrl)
    strictEqual(res.statusCode, 200)

    const data = await res.body.json()
    deepStrictEqual(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    const res = await request(entryUrl + '/service-app/')
    strictEqual(res.statusCode, 200)

    const data = await res.body.json()
    deepStrictEqual(data, { hello: 'hello123' })
  }
})

test('composer-proxy', async t => {
  const configFile = join(fixturesDir, 'composer-proxy', 'platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const entryUrl = await app.start()

  ok(entryUrl.startsWith('http://127.0.0.1'), 'entryUrl should start with http://127.0.0.1')
})

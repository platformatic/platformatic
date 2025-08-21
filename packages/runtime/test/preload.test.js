import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('preload', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/hello')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { value: 42 })
  }
})

test('preload multiple', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-single-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/preload')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { value: '12' })
  }
})

test('preload multiple on runtime and preload multiple on applications', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-multiple-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/a/preload')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { value: '1234' })
  }

  {
    const res = await request(entryUrl + '/b/preload')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { value: '125' })
  }
})

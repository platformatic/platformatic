import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('node-options on worker threads', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-multiple-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/a/node-options')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), {
      pid: process.pid,
      value: '--network-family-autoselection-attempt-timeout=100'
    })
  }

  {
    const res = await request(entryUrl + '/b/node-options')

    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), {
      pid: process.pid,
      value: '--network-family-autoselection-attempt-timeout=200'
    })
  }
})

test('node-options on separate processes', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-multiple-service.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/c/node-options')

    strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    ok(body.value.endsWith(' --network-family-autoselection-attempt-timeout=300'))
    notStrictEqual(body.pid, process.pid)
  }
})

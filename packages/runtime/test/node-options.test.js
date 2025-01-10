'use strict'
const { deepStrictEqual, notStrictEqual, ok, strictEqual } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('node-options on worker threads', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'preload-multiple', 'platformatic-multiple-service.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
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
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
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

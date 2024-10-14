'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('..')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('should cache http requests', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  await sleep(cacheTimeoutSec * 1000)

  const res = await request(entryUrl + '/service-1/cached-req-counter', {
    query: { maxAge: cacheTimeoutSec }
  })

  assert.strictEqual(res.statusCode, 200)

  const cacheControl = res.headers['cache-control']
  assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

  const { counter } = await res.body.json()
  assert.strictEqual(counter, 2)
})

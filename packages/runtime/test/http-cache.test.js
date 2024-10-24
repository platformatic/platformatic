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

  const cachedRequests = await app.getCachedHttpRequests()
  assert.deepStrictEqual(cachedRequests, [
    { method: 'GET', url: 'http://service-1.plt.local/cached-req-counter?maxAge=5' }
  ])
})

test('should get response cached by another service', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  {
    // Making a request to the service-3 through the service-1
    // It should increase the counter and put the response in the cache
    const res = await request(entryUrl + '/service-1/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    assert.strictEqual(counter, 1)
    assert.strictEqual(service, 'service-3')
  }

  {
    // Making a request to the service-3 through the service-2
    // It should get the response from the cache
    const res = await request(entryUrl + '/service-2/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    assert.strictEqual(counter, 1)
    assert.strictEqual(service, 'service-3')
  }

  // Wait for the cache to expire
  await sleep(cacheTimeoutSec * 1000)

  {
    // Making a request to the service-3 through the service-2
    // It should increase the counter and put the response in the cache
    const res = await request(entryUrl + '/service-2/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    assert.strictEqual(counter, 2)
    assert.strictEqual(service, 'service-3')
  }
})

test('should use a custom cache storage', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  config.configManager.current.httpCache = {
    store: join(fixturesDir, 'http-cache', 'custom-cache-store.js')
  }

  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 10

  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const response = await res.body.text()
    assert.strictEqual(response, 'Custom cache store response')
  }

  const res = await request(entryUrl + '/service-1/cached-req-counter', {
    query: { maxAge: cacheTimeoutSec }
  })

  assert.strictEqual(res.statusCode, 200)

  const cacheControl = res.headers['cache-control']
  assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

  const { counter } = await res.body.json()
  assert.strictEqual(counter, 1)
})

test('should remove a url from an http cache', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 100

  {
    // Caching the response
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const cachedRequests = await app.getCachedHttpRequests()
    assert.deepStrictEqual(cachedRequests, [
      { method: 'GET', url: 'http://service-1.plt.local/cached-req-counter?maxAge=100' }
    ])
  }

  await app.invalidateHttpCache({
    origin: 'http://service-1.plt.local',
    routes: [
      { method: 'GET', path: '/cached-req-counter?maxAge=100' }
    ]
  })

  {
    // Checking if the response is removed from the cache
    const cachedRequests = await app.getCachedHttpRequests()
    assert.deepStrictEqual(cachedRequests, [])
  }

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 2)
  }
})

test('should invalidate cache from another service', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 100

  {
    // Caching the response
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Invalidating the cache from the service-2
    const res = await request(entryUrl + '/service-2/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin: 'http://service-1.plt.local',
        routes: [
          { method: 'GET', path: '/cached-req-counter?maxAge=100' }
        ]
      })
    })
    assert.strictEqual(res.statusCode, 200)
  }

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 2)
  }
})

test('should invalidate cache by cache tags', async (t) => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  config.configManager.current.httpCache = {
    cacheTagsHeader: 'Cache-Tags'
  }

  const app = await buildServer(config.configManager.current)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 100

  {
    // Caching the response
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: {
        maxAge: cacheTimeoutSec,
        cacheTags: ['tag1', 'tag2']
      }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const cacheTags = res.headers['cache-tags']
    assert.strictEqual(cacheTags, 'tag1,tag2')

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: {
        maxAge: cacheTimeoutSec,
        cacheTags: ['tag1', 'tag2']
      },
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const cacheTags = res.headers['cache-tags']
    assert.strictEqual(cacheTags, 'tag1,tag2')

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 1)
  }

  {
    // Invalidating the cache from the service-2
    const res = await request(entryUrl + '/service-2/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin: 'http://service-1.plt.local',
        tags: ['tag1']
      })
    })
    assert.strictEqual(res.statusCode, 200)
  }

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: {
        maxAge: cacheTimeoutSec,
        cacheTags: ['tag1', 'tag2']
      }
    })

    assert.strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    assert.strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    assert.strictEqual(counter, 2)
  }
})

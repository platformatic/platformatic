import { parseNDJson } from '@platformatic/telemetry/test/helper.js'
import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { gunzipSync } from 'node:zlib'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should cache http requests', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  let firstCacheEntryId = null
  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    const cacheEntryId = res.headers['x-plt-http-cache-id']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)
    ok(cacheEntryId)

    if (firstCacheEntryId === null) {
      firstCacheEntryId = cacheEntryId
    } else {
      strictEqual(cacheEntryId, firstCacheEntryId)
    }

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  await sleep(cacheTimeoutSec * 1000)

  const res = await request(entryUrl + '/service-1/cached-req-counter', {
    query: { maxAge: cacheTimeoutSec }
  })

  strictEqual(res.statusCode, 200)

  const cacheControl = res.headers['cache-control']
  const cacheEntryId = res.headers['x-plt-http-cache-id']
  strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)
  ok(cacheEntryId)
  notStrictEqual(cacheEntryId, firstCacheEntryId)

  const { counter } = await res.body.json()
  strictEqual(counter, 2)
})

test('should get response cached by another application', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  {
    // Making a request to the service-3 through the service-1
    // It should increase the counter and put the response in the cache
    const res = await request(entryUrl + '/service-1/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    strictEqual(counter, 1)
    strictEqual(service, 'service-3')
  }

  {
    // Making a request to the service-3 through the service-2
    // It should get the response from the cache
    const res = await request(entryUrl + '/service-2/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    strictEqual(counter, 1)
    strictEqual(service, 'service-3')
  }

  // Wait for the cache to expire
  await sleep(cacheTimeoutSec * 1000)

  {
    // Making a request to the service-3 through the service-2
    // It should increase the counter and put the response in the cache
    const res = await request(entryUrl + '/service-2/service-3/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter, service } = await res.body.json()
    strictEqual(counter, 2)
    strictEqual(service, 'service-3')
  }
})

test('should use a custom cache storage', async t => {
  const cacheStoreOptions = {
    maxCount: 42,
    maxSize: 424242,
    maxEntrySize: 4242
  }

  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.httpCache = {
        store: join(fixturesDir, 'http-cache', 'custom-cache-store.js'),
        ...cacheStoreOptions
      }
      return config
    }
  })
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 10

  {
    // Caching the response
    const { statusCode, body } = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })
    strictEqual(statusCode, 200)

    const { counter } = await body.json()
    strictEqual(counter, 1)

    await sleep(1000)
  }

  const { statusCode, headers, body } = await request(entryUrl + '/service-1/cached-req-counter', {
    query: { maxAge: cacheTimeoutSec }
  })
  strictEqual(statusCode, 200)

  const { message, options, entries } = await body.json()
  strictEqual(message, 'Custom cache store response')
  deepStrictEqual(options, cacheStoreOptions)
  strictEqual(entries.length, 1)

  const cacheEntry = entries[0]
  const cacheEntryId = headers['x-plt-http-cache-id']
  strictEqual(cacheEntry.key.id, cacheEntryId)
})

test('should remove a url from an http cache', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 100

  {
    // Caching the response
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  await app.invalidateHttpCache({
    keys: [
      {
        origin: 'http://service-1.plt.local',
        path: '/cached-req-counter?maxAge=100',
        method: 'GET'
      }
    ]
  })

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 2)
  }
})

test('should invalidate cache from another application', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 100

  {
    // Caching the response
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  {
    // Invalidating the cache from the service-2
    const res = await request(entryUrl + '/service-2/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keys: [
          {
            origin: 'http://service-1.plt.local',
            path: '/cached-req-counter?maxAge=100',
            method: 'GET'
          }
        ]
      })
    })
    strictEqual(res.statusCode, 200)
  }

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: { maxAge: cacheTimeoutSec }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 2)
  }
})

test('should invalidate cache by cache tags', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.httpCache = {
        cacheTagsHeader: 'Cache-Tags'
      }
      return config
    }
  })
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

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const cacheTags = res.headers['cache-tags']
    strictEqual(cacheTags, 'tag1,tag2')

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  {
    // Checking if the response is cached
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: {
        maxAge: cacheTimeoutSec,
        cacheTags: ['tag1', 'tag2']
      }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const cacheTags = res.headers['cache-tags']
    strictEqual(cacheTags, 'tag1,tag2')

    const { counter } = await res.body.json()
    strictEqual(counter, 1)
  }

  {
    // Invalidating the cache from the service-2
    const res = await request(entryUrl + '/service-2/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tags: ['tag1'] })
    })
    strictEqual(res.statusCode, 200)
  }

  {
    const res = await request(entryUrl + '/service-1/cached-req-counter', {
      query: {
        maxAge: cacheTimeoutSec,
        cacheTags: ['tag1', 'tag2']
      }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)

    const { counter } = await res.body.json()
    strictEqual(counter, 2)
  }
})

test('should set an opentelemetry attribute', async t => {
  const telemetryFilePath = join(tmpdir(), 'telemetry.ndjson')
  await rm(telemetryFilePath, { force: true }).catch(() => {})

  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.telemetry = {
        applicationName: 'test-service',
        version: '1.0.0',
        exporter: {
          type: 'file',
          options: { path: telemetryFilePath }
        }
      }

      return config
    }
  })
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  {
    // Request should reach the origin
    const url = entryUrl + '/service-2/service-3-http/cached-req-counter'
    const { statusCode, body } = await request(url, {
      query: { maxAge: cacheTimeoutSec }
    })
    const error = await body.text()
    strictEqual(statusCode, 200, error)
  }

  await sleep(100)

  let resultCacheId1 = null
  {
    const traces = await parseNDJson(telemetryFilePath)
    const serverTraces = traces.filter(trace => trace.kind === 1)
    const clientTraces = traces.filter(trace => trace.kind === 2)

    strictEqual(serverTraces.length, 4)
    strictEqual(clientTraces.length, 3)

    for (const trace of serverTraces) {
      const cacheIdAttribute = trace.attributes['http.cache.id']
      const cacheHitAttribute = trace.attributes['http.cache.hit']
      strictEqual(cacheIdAttribute, undefined)
      strictEqual(cacheHitAttribute, undefined)
    }

    let previousCacheIdAttribute = null
    for (const trace of clientTraces) {
      const cacheIdAttribute = trace.attributes['http.cache.id']
      const cacheHitAttribute = trace.attributes['http.cache.hit']
      ok(cacheIdAttribute)
      notStrictEqual(cacheIdAttribute, previousCacheIdAttribute)
      strictEqual(cacheHitAttribute, 'false')
      previousCacheIdAttribute = cacheIdAttribute
    }

    resultCacheId1 = clientTraces.at(-1).attributes['http.cache.id']
  }

  await rm(telemetryFilePath, { force: true }).catch(() => {})

  {
    // Request should be returned from the cache
    const url = entryUrl + '/service-2/service-3-http/cached-req-counter'
    const { statusCode, body } = await request(url, {
      query: { maxAge: cacheTimeoutSec }
    })
    const error = await body.text()
    strictEqual(statusCode, 200, error)
  }

  await sleep(100)

  {
    const traces = await parseNDJson(telemetryFilePath)
    const serverTraces = traces.filter(trace => trace.kind === 1)
    const clientTraces = traces.filter(trace => trace.kind === 2)

    strictEqual(serverTraces.length, 1)
    strictEqual(clientTraces.length, 1)

    for (const trace of serverTraces) {
      const cacheIdAttribute = trace.attributes['http.cache.id']
      const cacheHitAttribute = trace.attributes['http.cache.hit']
      strictEqual(cacheIdAttribute, undefined)
      strictEqual(cacheHitAttribute, undefined)
    }

    let previousCacheIdAttribute = null
    for (const trace of clientTraces) {
      const cacheIdAttribute = trace.attributes['http.cache.id']
      const cacheHitAttribute = trace.attributes['http.cache.hit']
      ok(cacheIdAttribute)
      notStrictEqual(cacheIdAttribute, previousCacheIdAttribute)
      strictEqual(cacheHitAttribute, 'true')
      previousCacheIdAttribute = cacheIdAttribute
    }

    const resultCacheId2 = clientTraces.at(-1).attributes['http.cache.id']
    strictEqual(resultCacheId1, resultCacheId2)
  }
})

test('should cache http requests gzipped', async t => {
  const configFile = join(fixturesDir, 'http-cache', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const cacheTimeoutSec = 5

  let firstCacheEntryId = null
  for (let i = 0; i < 5; i++) {
    const res = await request(entryUrl + '/service-1/gzip-req-counter', {
      query: { maxAge: cacheTimeoutSec },
      headers: {
        'accept-encoding': 'gzip'
      }
    })

    strictEqual(res.statusCode, 200)

    const cacheControl = res.headers['cache-control']
    const cacheEntryId = res.headers['x-plt-http-cache-id']
    strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)
    ok(cacheEntryId)

    if (firstCacheEntryId === null) {
      firstCacheEntryId = cacheEntryId
    } else {
      strictEqual(cacheEntryId, firstCacheEntryId)
    }

    const buf = await res.body.arrayBuffer()
    const { counter } = JSON.parse(gunzipSync(buf))
    strictEqual(counter, 1)
  }

  await sleep(cacheTimeoutSec * 1000)

  const res = await request(entryUrl + '/service-1/gzip-req-counter', {
    query: { maxAge: cacheTimeoutSec },
    headers: {
      'Accept-Encoding': 'gzip'
    }
  })

  strictEqual(res.statusCode, 200)

  const cacheControl = res.headers['cache-control']
  const cacheEntryId = res.headers['x-plt-http-cache-id']
  strictEqual(cacheControl, `public, s-maxage=${cacheTimeoutSec}`)
  ok(cacheEntryId)
  notStrictEqual(cacheEntryId, firstCacheEntryId)

  const { counter } = JSON.parse(gunzipSync(await res.body.arrayBuffer()))
  strictEqual(counter, 2)
})

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createDeduplicationHandler } from '../lib/deduplication/index.js'
import { MemoryDeduplicationStorage } from '../lib/deduplication/memory-storage.js'
import { ValkeyDeduplicationStorage } from '../lib/deduplication/valkey-storage.js'
import { createApplication, createFromConfig } from './helper.js'

const valkeyHost = process.env.VALKEY_HOST ?? '127.0.0.1'
const valkeyPort = process.env.VALKEY_PORT ?? 6379
const valkeyUrl = process.env.PLT_TESTS_VALKEY_URL ?? process.env.VALKEY_URL ?? `redis://${valkeyHost}:${valkeyPort}`

async function createCountingApplication (t) {
  let count = 0
  const application = await createApplication(t, [
    {
      method: 'GET',
      path: '/value',
      handler: async req => {
        count++
        const current = count
        await sleep(100)
        return { count: current, query: req.query, cookie: req.headers.cookie }
      }
    },
    {
      method: 'POST',
      path: '/value',
      handler: async () => {
        count++
        const current = count
        await sleep(100)
        return { count: current }
      }
    },
    {
      method: 'GET',
      path: '/other',
      handler: async () => {
        count++
        const current = count
        await sleep(100)
        return { count: current }
      }
    },
    {
      method: 'GET',
      path: '/large',
      handler: async () => {
        count++
        return 'large-response'
      }
    }
  ])

  return {
    application,
    get count () {
      return count
    }
  }
}

async function createGateway (t, origin, deduplication, extraGatewayConfig = {}) {
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      deduplication,
      applications: [
        {
          id: 'main',
          origin,
          proxy: {
            prefix: '/api'
          }
        }
      ],
      ...extraGatewayConfig
    }
  })

  return gateway.start({ listen: true })
}

async function getJson (origin, path, options) {
  const { statusCode, body } = await request(origin, { method: 'GET', path, ...options })
  assert.equal(statusCode, 200)
  return body.json()
}

function createDeduplicationMetrics () {
  const createCounter = () => ({
    value: 0,
    inc () {
      this.value++
    }
  })

  return {
    deduplicationLeader: createCounter(),
    deduplicationWaiter: createCounter(),
    deduplicationReplay: createCounter(),
    deduplicationFallback: createCounter(),
    deduplicationError: createCounter()
  }
}

async function createDeduplicationTestHandler (deduplication, handler, metrics) {
  return createDeduplicationHandler({
    app: {
      addHook () {},
      log: {
        error () {}
      }
    },
    application: { id: 'main', origin: 'http://origin.example' },
    baseConfig: deduplication,
    handler,
    metrics,
    root: import.meta.dirname
  })
}

function createReply () {
  return {
    statusCode: null,
    responseHeaders: null,
    payload: null,
    code (statusCode) {
      this.statusCode = statusCode
      return this
    },
    headers (headers) {
      this.responseHeaders = headers
      return this
    },
    getHeaders () {
      return { 'content-type': 'text/plain' }
    },
    async send (payload) {
      this.payload = payload

      if (payload?.[Symbol.asyncIterator]) {
        const chunks = []

        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        this.payload = Buffer.concat(chunks)
      }

      return payload
    }
  }
}

function createRequest () {
  return { method: 'GET', url: '/api/value', headers: {}, query: {} }
}

test('should proxy normally without deduplication or a custom handler', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin)

  const response = await getJson(gatewayOrigin, '/api/value')

  assert.equal(upstream.count, 1)
  assert.deepEqual(response, { count: 1, query: {} })
})

test('should deduplicate concurrent GET requests with memory storage', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all(Array.from({ length: 5 }, () => getJson(gatewayOrigin, '/api/value?x=1')))

  assert.equal(upstream.count, 1)
  assert.deepEqual(
    responses,
    Array.from({ length: 5 }, () => ({ count: 1, query: { x: '1' } }))
  )
})

test('should deduplicate when enabled at application proxy level', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'main',
          origin,
          proxy: {
            prefix: '/api',
            deduplication: {
              enabled: true,
              lockTtl: 2000,
              ttl: 1000
            }
          }
        }
      ]
    }
  })
  const gatewayOrigin = await gateway.start({ listen: true })

  const responses = await Promise.all(Array.from({ length: 2 }, () => getJson(gatewayOrigin, '/api/value')))

  assert.equal(upstream.count, 1)
  assert.deepEqual(responses, [
    { count: 1, query: {} },
    { count: 1, query: {} }
  ])
})

test('should include query string in the deduplication key', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all([
    getJson(gatewayOrigin, '/api/value?x=1'),
    getJson(gatewayOrigin, '/api/value?x=2')
  ])

  assert.equal(upstream.count, 2)
  assert.deepEqual(responses, [
    { count: 1, query: { x: '1' } },
    { count: 2, query: { x: '2' } }
  ])
})

test('should include configured headers in the deduplication key', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    headers: ['cookie'],
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all([
    getJson(gatewayOrigin, '/api/value', { headers: { cookie: 'a=1' } }),
    getJson(gatewayOrigin, '/api/value', { headers: { cookie: 'a=2' } })
  ])

  assert.equal(upstream.count, 2)
  assert.deepEqual(responses, [
    { count: 1, query: {}, cookie: 'a=1' },
    { count: 2, query: {}, cookie: 'a=2' }
  ])
})

test('should deduplicate configured headers regardless of insertion order', async () => {
  let upstreamCalls = 0
  const handler = await createDeduplicationTestHandler(
    { enabled: true, headers: ['x-b', 'x-a'], lockTtl: 2000, ttl: 1000 },
    async (_request, reply, _dest, options) => {
      upstreamCalls++
      await sleep(100)
      return options.onResponse(createRequest(), reply, {
        statusCode: 200,
        headers: {},
        stream: ReadableStream.from([Buffer.from('ok')])
      })
    }
  )

  const firstRequest = { ...createRequest(), headers: { 'x-a': '1', 'x-b': '2' } }
  const secondRequest = { ...createRequest(), headers: { 'x-b': '2', 'x-a': '1' } }

  await Promise.all([handler(firstRequest, createReply(), '/value', {}), handler(secondRequest, createReply(), '/value', {})])

  assert.equal(upstreamCalls, 1)
})

test('should not deduplicate methods outside of the configured methods', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all(
    Array.from({ length: 2 }, async () => {
      const { statusCode, body } = await request(gatewayOrigin, { method: 'POST', path: '/api/value' })
      assert.equal(statusCode, 200)
      return body.json()
    })
  )

  assert.equal(upstream.count, 2)
  assert.deepEqual(responses, [{ count: 1 }, { count: 2 }])
})

test('should apply deduplication only to configured routes', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    routes: [{ method: 'GET', path: '/api/value' }],
    lockTtl: 2000,
    ttl: 1000
  })

  await Promise.all(Array.from({ length: 2 }, () => getJson(gatewayOrigin, '/api/value')))
  await Promise.all(Array.from({ length: 2 }, () => getJson(gatewayOrigin, '/api/other')))

  assert.equal(upstream.count, 3)
})

test('should use a custom deduplication key function', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    key: resolve(import.meta.dirname, './proxy/fixtures/deduplication-key.js'),
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all([
    getJson(gatewayOrigin, '/api/value?x=1'),
    getJson(gatewayOrigin, '/api/value?x=2')
  ])

  assert.equal(upstream.count, 1)
  assert.deepEqual(responses, [
    { count: 1, query: { x: '1' } },
    { count: 1, query: { x: '1' } }
  ])
})

test('should deduplicate before delegating to a custom gateway handler', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(
    t,
    origin,
    {
      enabled: true,
      lockTtl: 2000,
      ttl: 1000
    },
    {
      handler: resolve(import.meta.dirname, './proxy/fixtures/default-handler.js')
    }
  )

  const responses = await Promise.all(Array.from({ length: 2 }, () => getJson(gatewayOrigin, '/api/value')))

  assert.equal(upstream.count, 1)
  assert.deepEqual(responses, [
    { count: 1, query: {} },
    { count: 1, query: {} }
  ])
})

test('should expose a response helper to custom gateway handlers', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(
    t,
    origin,
    {
      enabled: true,
      lockTtl: 2000,
      ttl: 1000
    },
    {
      handler: resolve(import.meta.dirname, './proxy/fixtures/deduplication-handler.js')
    }
  )

  const responses = await Promise.all(
    Array.from({ length: 2 }, async () => {
      const { statusCode, headers, body } = await request(gatewayOrigin, { method: 'GET', path: '/api/value' })
      assert.equal(statusCode, 200)
      assert.equal(headers['x-deduplication-handler'], 'true')
      return body.json()
    })
  )

  assert.equal(upstream.count, 1)
  assert.deepEqual(responses, [
    { count: 1, query: {} },
    { count: 1, query: {} }
  ])
})

test('should expose an error helper to custom gateway handlers', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(
    t,
    origin,
    {
      enabled: true,
      timeout: 1,
      retries: 0,
      lockTtl: 2000,
      ttl: 1000
    },
    {
      handler: resolve(import.meta.dirname, './proxy/fixtures/deduplication-error-handler.js')
    }
  )

  const { statusCode, body } = await request(gatewayOrigin, { method: 'GET', path: '/api/value' })

  assert.equal(upstream.count, 0)
  assert.equal(statusCode, 500)
  assert.match(await body.text(), /custom failure/)
})

test('should replay large responses', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    lockTtl: 2000,
    ttl: 1000
  })

  const { statusCode, body } = await request(gatewayOrigin, { method: 'GET', path: '/api/large' })

  assert.equal(statusCode, 200)
  assert.equal(await body.text(), 'large-response')
})

test('should fallback to a normal request after exhausting retries', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    timeout: 1,
    retries: 0,
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all(Array.from({ length: 2 }, () => getJson(gatewayOrigin, '/api/value')))

  assert.equal(upstream.count, 2)
  assert.deepEqual(responses, [
    { count: 1, query: {} },
    { count: 2, query: {} }
  ])
})

test('should increment leader waiter and replay metrics', async () => {
  const metrics = createDeduplicationMetrics()
  let upstreamCalls = 0
  const handler = await createDeduplicationTestHandler(
    { enabled: true, lockTtl: 2000, ttl: 1000 },
    async (_request, _reply, _dest, options) => {
      upstreamCalls++
      await sleep(100)
      return options.onResponse(createRequest(), createReply(), {
        statusCode: 200,
        headers: {},
        stream: ReadableStream.from([Buffer.from('ok')])
      })
    },
    metrics
  )

  const requests = Array.from({ length: 3 }, () => handler(createRequest(), createReply(), '/value', {}))
  await Promise.all(requests)

  assert.equal(upstreamCalls, 1)
  assert.equal(metrics.deduplicationLeader.value, 1)
  assert.equal(metrics.deduplicationWaiter.value, 2)
  assert.equal(metrics.deduplicationReplay.value, 2)
})

test('should replay binary chunks without concatenating before storage', async () => {
  let upstreamCalls = 0
  const handler = await createDeduplicationTestHandler(
    { enabled: true, lockTtl: 2000, ttl: 1000 },
    async (_request, reply, _dest, options) => {
      upstreamCalls++
      await sleep(100)
      return options.onResponse(createRequest(), reply, {
        statusCode: 200,
        headers: {},
        stream: ReadableStream.from([Buffer.from('he'), Buffer.from('ll'), Buffer.from('o')])
      })
    }
  )

  const replies = [createReply(), createReply()]
  await Promise.all(replies.map(reply => handler(createRequest(), reply, '/value', {})))

  assert.equal(upstreamCalls, 1)
  assert.deepEqual(
    replies.map(reply => reply.payload.toString()),
    ['hello', 'hello']
  )
})

test('should increment fallback metric', async () => {
  const metrics = createDeduplicationMetrics()
  let upstreamCalls = 0
  const handler = await createDeduplicationTestHandler(
    { enabled: true, timeout: 1, retries: 0, lockTtl: 2000, ttl: 1000 },
    async (_request, reply, _dest, options) => {
      upstreamCalls++
      if (options.onResponse) {
        await sleep(100)
        return options.onResponse(createRequest(), reply, {
          statusCode: 200,
          headers: {},
          stream: ReadableStream.from([Buffer.from('ok')])
        })
      }

      return reply.send('fallback')
    },
    metrics
  )

  await Promise.all(Array.from({ length: 2 }, () => handler(createRequest(), createReply(), '/value', {})))

  assert.equal(upstreamCalls, 2)
  assert.equal(metrics.deduplicationFallback.value, 1)
})

test('should increment error metric', async () => {
  const metrics = createDeduplicationMetrics()
  const handler = await createDeduplicationTestHandler(
    { enabled: true, lockTtl: 2000, ttl: 1000 },
    async (_request, reply, _dest, options) => {
      return options.onError(reply, { error: new Error('boom') })
    },
    metrics
  )

  await handler(createRequest(), createReply(), '/value', {})

  assert.equal(metrics.deduplicationError.value, 1)
})

test('should notify all memory waiters for the same key', async t => {
  const storage = new MemoryDeduplicationStorage()
  t.after(() => storage.close())

  const waiters = [storage.wait('key', 1000), storage.wait('key', 1000), storage.wait('key', 1000)]
  await sleep(50)
  await storage.notify('key', 'response-id', 1000)

  assert.deepEqual(await Promise.all(waiters), ['response-id', 'response-id', 'response-id'])
})

test('should resolve memory waiters on close', async () => {
  const storage = new MemoryDeduplicationStorage()
  const waiter = storage.wait('key', 1000)

  await storage.close()

  assert.equal(await waiter, null)
})

test('should notify all Valkey waiters for the same key', async t => {
  const storage = new ValkeyDeduplicationStorage({ url: valkeyUrl, prefix: `test-${Date.now()}` })
  t.after(() => storage.close())

  const waiters = [storage.wait('key', 1000), storage.wait('key', 1000), storage.wait('key', 1000)]
  await sleep(50)
  await storage.notify('key', 'response-id', 1000)

  assert.deepEqual(await Promise.all(waiters), ['response-id', 'response-id', 'response-id'])
})

test('should expire the Valkey responsesIds pointer atomically', async t => {
  const storage = new ValkeyDeduplicationStorage({ url: valkeyUrl, prefix: `test-${Date.now()}` })
  t.after(() => storage.close())

  await storage.notify('key', 'response-id', 50)
  assert.equal(await storage.wait('key', 1), 'response-id')
  await sleep(75)
  assert.equal(await storage.wait('key', 1), null)
})

test('should deduplicate concurrent GET requests with Valkey storage', async t => {
  const upstream = await createCountingApplication(t)
  const origin = await upstream.application.listen({ port: 0 })
  const gatewayOrigin = await createGateway(t, origin, {
    enabled: true,
    storage: {
      adapter: 'valkey',
      url: valkeyUrl,
      prefix: `test-${Date.now()}`
    },
    lockTtl: 2000,
    ttl: 1000
  })

  const responses = await Promise.all(Array.from({ length: 5 }, () => getJson(gatewayOrigin, '/api/value?x=1')))

  assert.equal(upstream.count, 1)
  assert.deepEqual(
    responses,
    Array.from({ length: 5 }, () => ({ count: 1, query: { x: '1' } }))
  )
})

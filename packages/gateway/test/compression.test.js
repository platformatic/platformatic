import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { brotliCompressSync, brotliDecompressSync, gunzipSync } from 'node:zlib'
import { request } from 'undici'
import { createApplication, createFromConfig, createGatewayInRuntime, REFRESH_TIMEOUT } from './helper.js'

const page = '<p>hello world</p>'.repeat(1000)

async function createUpstream (t, routes = []) {
  const upstream = await createApplication(t, [
    {
      method: 'GET',
      url: '/page',
      handler (req, reply) {
        reply.type('text/html')
        reply.header('x-received-accept-encoding', req.headers['accept-encoding'] ?? '')
        reply.send(page)
      }
    },
    ...routes
  ])

  return upstream.listen({ port: 0, host: '127.0.0.1' })
}

async function createGateway (t, upstream, compression, proxy = {}, gateway = {}) {
  const config = {
    server: { logger: { level: 'fatal' } },
    gateway: {
      compression,
      applications: [{ id: 'upstream', proxy: { prefix: '/', upstream, ...proxy } }],
      ...gateway
    }
  }

  const instance = await createFromConfig(t, config)
  return instance.start({ listen: true })
}

async function get (origin, path, acceptEncoding = 'br, gzip') {
  const headers = acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}
  const response = await request(origin, { method: 'GET', path, headers })
  const body = Buffer.from(await response.body.arrayBuffer())

  return { statusCode: response.statusCode, headers: response.headers, body }
}

test('should not compress when compression is not configured', async t => {
  const upstream = await createUpstream(t)
  const origin = await createGateway(t, upstream, undefined)

  const { headers, body } = await get(origin, '/page')
  assert.equal(headers['content-encoding'], undefined)
  assert.equal(headers.vary, undefined)
  assert.equal(body.toString(), page)
})

test('should not compress when compression is disabled', async t => {
  const upstream = await createUpstream(t)

  for (const compression of [false, 'false', { enabled: false }]) {
    const origin = await createGateway(t, upstream, compression)

    const { headers } = await get(origin, '/page')
    assert.equal(headers['content-encoding'], undefined, `compression: ${JSON.stringify(compression)}`)
  }
})

test('should compress with the preferred encoding accepted by the client', async t => {
  const upstream = await createUpstream(t)
  const origin = await createGateway(t, upstream, true)

  {
    const { headers, body } = await get(origin, '/page', 'gzip, deflate, br')
    assert.equal(headers['content-encoding'], 'br')
    assert.equal(headers.vary, 'accept-encoding')
    assert.equal(headers['content-length'], undefined)
    assert.equal(brotliDecompressSync(body).toString(), page)
    // The upstream is not an application of the runtime, so it gets the Accept-Encoding of the client
    assert.equal(headers['x-received-accept-encoding'], 'gzip, deflate, br')
  }

  {
    const { headers, body } = await get(origin, '/page', 'gzip')
    assert.equal(headers['content-encoding'], 'gzip')
    assert.equal(gunzipSync(body).toString(), page)
  }

  {
    const { headers, body } = await get(origin, '/page', null)
    assert.equal(headers['content-encoding'], undefined)
    assert.equal(headers.vary, 'accept-encoding')
    assert.equal(body.toString(), page)
  }
})

test('should only offer the configured encodings', async t => {
  const upstream = await createUpstream(t)
  const origin = await createGateway(t, upstream, { encodings: ['gzip'] })

  const { headers, body } = await get(origin, '/page', 'br, gzip')
  assert.equal(headers['content-encoding'], 'gzip')
  assert.equal(gunzipSync(body).toString(), page)
})

test('should leave alone the responses it should not compress', async t => {
  const upstream = await createUpstream(t, [
    {
      method: 'GET',
      url: '/small',
      handler (_, reply) {
        reply.type('text/html').send('<p>small</p>')
      }
    },
    {
      method: 'GET',
      url: '/encoded',
      handler (_, reply) {
        reply.type('text/html').header('content-encoding', 'br').send(brotliCompressSync(page))
      }
    },
    {
      method: 'GET',
      url: '/no-transform',
      handler (_, reply) {
        reply.type('text/html').header('cache-control', 'public, No-Transform').send(page)
      }
    },
    {
      method: 'GET',
      url: '/image',
      handler (_, reply) {
        reply.type('image/png').send(Buffer.alloc(10_000))
      }
    },
    {
      method: 'GET',
      url: '/cdn/page',
      handler (_, reply) {
        reply.type('text/html').send(page)
      }
    },
    {
      method: 'GET',
      url: '/partial',
      handler (_, reply) {
        reply.code(206).type('text/html').header('content-range', `bytes 0-1999/${page.length}`).send(page.slice(0, 2000))
      }
    }
  ])
  const origin = await createGateway(t, upstream, { exclude: ['/cdn/*'] })

  {
    const { headers, body } = await get(origin, '/small')
    assert.equal(headers['content-encoding'], undefined)
    assert.equal(headers.vary, undefined)
    assert.equal(body.toString(), '<p>small</p>')
  }

  {
    const { headers, body } = await get(origin, '/encoded')
    assert.equal(headers['content-encoding'], 'br')
    assert.equal(brotliDecompressSync(body).toString(), page)
  }

  for (const path of ['/no-transform', '/image', '/cdn/page', '/partial']) {
    const { headers } = await get(origin, path)
    assert.equal(headers['content-encoding'], undefined, path)
    assert.equal(headers.vary, undefined, path)
  }

  {
    // The exclusion matches the path, not the query string
    const { headers } = await get(origin, '/page?from=/cdn/page')
    assert.equal(headers['content-encoding'], 'br')
  }
})

test('should not compress the responses of an application which opted out', async t => {
  const upstream = await createUpstream(t)
  const origin = await createGateway(t, upstream, true, { compression: false })

  const { headers, body } = await get(origin, '/page')
  assert.equal(headers['content-encoding'], undefined)
  assert.equal(headers.vary, undefined)
  assert.equal(body.toString(), page)
})

test('should decide whether to compress by environment', async t => {
  const upstream = await createUpstream(t)
  const origin = await createGateway(t, upstream, { enabled: { development: false } })

  const { headers } = await get(origin, '/page')
  assert.equal(headers['content-encoding'], undefined)
})

test('should compress the responses replayed by the deduplication', async t => {
  const upstream = await createUpstream(t, [
    {
      method: 'GET',
      url: '/slow',
      async handler (_, reply) {
        await sleep(500)
        reply.type('text/html').send(page)
      }
    }
  ])
  const origin = await createGateway(t, upstream, true, {}, { deduplication: { enabled: true } })

  const responses = await Promise.all([get(origin, '/slow'), get(origin, '/slow'), get(origin, '/slow')])

  for (const { headers, body } of responses) {
    assert.equal(headers['content-encoding'], 'br')
    assert.equal(brotliDecompressSync(body).toString(), page)
  }
})

test('should ask the applications of the runtime for uncompressed responses', async t => {
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-compression',
    {
      gateway: {
        compression: true,
        applications: [
          { id: 'main', proxy: { prefix: '/main' } },
          { id: 'other', proxy: { prefix: '/other', compression: false } }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      { id: 'main', path: resolve(import.meta.dirname, './proxy/fixtures/compression') },
      { id: 'other', path: resolve(import.meta.dirname, './proxy/fixtures/compression') }
    ]
  )

  const origin = await runtime.start()

  {
    const { headers, body } = await get(origin, '/main/page')
    assert.equal(headers['content-encoding'], 'br')
    assert.equal(headers['x-received-accept-encoding'], 'identity')
    assert.equal(brotliDecompressSync(body).toString(), page)
  }

  {
    // An application which opted out gets the Accept-Encoding of the client and compresses on its own, if it wants
    const { headers } = await get(origin, '/other/page')
    assert.equal(headers['x-received-accept-encoding'], 'br, gzip')
  }
})

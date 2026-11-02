import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { connect } from 'node:http2'
import { resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { createBrotliDecompress, createGunzip, gzipSync, gunzipSync } from 'node:zlib'
import Fastify from 'fastify'
import { request } from 'undici'
import { proxy } from '../lib/proxy.js'
import { ensureSafePrefix } from '../lib/early-flush/html.js'
import { resolveOptions } from '../lib/early-flush/options.js'
import { Sampler } from '../lib/early-flush/sampler.js'
import { createFromConfig } from './helper.js'

const prefix = '<!doctype html><html><head><title>Shared</title></head><body><main>'
const earlyFlush = { enabled: true, routes: [{ method: 'GET', path: '/page/:id' }], windowSize: 2, minPreludeBytes: 32 }

async function setup (t, { compression, deduplication, early = earlyFlush, handler, custom, gatewayHandler, onRequest, http2 = false, proxyOptions = {} } = {}) {
  const seen = []
  const logs = []
  let render = handler ?? ((req, reply) => reply.type('text/html').send(`${prefix}${req.params.id}</main></body></html>`))
  const upstream = Fastify()
  upstream.all('/page/:id', (req, reply) => {
    seen.push(req.headers['accept-encoding'])
    return render(req, reply)
  })
  upstream.get('/other', (req, reply) => {
    seen.push(req.headers['accept-encoding'])
    return reply.type('text/html').send(prefix)
  })
  const upstreamUrl = await upstream.listen({ host: '127.0.0.1', port: 0 })
  const app = Fastify({ http2, logger: { level: 'debug', stream: { write (line) { logs.push(JSON.parse(line)) } } } })
  if (onRequest) {
    app.addHook('onRequest', onRequest)
  }
  t.after(async () => {
    await app.close()
    await upstream.close()
  })
  await app.register(proxy, {
    handler: gatewayHandler,
    compression,
    deduplication,
    applications: [{ id: 'frontend', origin: upstreamUrl, proxy: { prefix: '/', earlyFlush: early, custom, ...proxyOptions } }]
  })
  const origin = await app.listen({ host: '127.0.0.1', port: 0 })
  return { origin, seen, logs, app, setRender (fn) { render = fn } }
}

async function get (origin, path, headers = {}) {
  const response = await request(origin + path, { headers })
  return { status: response.statusCode, headers: response.headers, body: await response.body.text() }
}

async function warm (origin) {
  for (const id of ['a', 'b']) {
    const result = await get(origin, `/page/${id}`)
    assert.equal(result.headers['x-early-flush'], 'miss')
    assert.equal(result.body, `${prefix}${id}</main></body></html>`)
  }
}

test('HTTP/2 requests learn and serve without forwarding pseudo-headers into Headers', { timeout: 10000 }, async t => {
  const { origin, seen } = await setup(t, { http2: true })
  const client = connect(origin)
  t.after(() => client.destroy())

  for (const [id, decision] of [['a', 'miss'], ['b', 'miss'], ['c', 'hit']]) {
    const stream = client.request({ ':path': `/page/${id}`, ':method': 'GET', 'accept-encoding': 'gzip' })
    const [headers] = await once(stream, 'response')
    let body = ''
    for await (const chunk of stream) {
      body += chunk.toString()
    }
    assert.equal(headers[':status'], 200)
    assert.equal(headers['x-early-flush'], decision)
    assert.equal(body, `${prefix}${id}</main></body></html>`)
  }

  assert.deepEqual(seen, ['identity', 'identity', 'identity'])
  client.close()
})

test('legacy custom handlers bypass early flush and preserve Fastify payload semantics', async t => {
  const gatewayHandler = resolve(import.meta.dirname, 'fixtures/early-flush-payload-handler.js')
  const disabled = await setup(t, { gatewayHandler, early: { ...earlyFlush, enabled: false } })
  const enabled = await setup(t, { gatewayHandler })

  for (const payload of ['uint8', 'data-view', 'null', 'undefined', 'null-text']) {
    const headers = { 'x-payload': payload }
    const baseline = await get(disabled.origin, '/page/a', headers)
    const response = await get(enabled.origin, '/page/a', headers)
    assert.equal(response.status, baseline.status, payload)
    assert.equal(response.body, baseline.body, payload)
    assert.equal(response.headers['content-type'], baseline.headers['content-type'], payload)
  }

  for (const id of ['a', 'b', 'c']) {
    const response = await get(enabled.origin, `/page/${id}`, { 'x-payload': 'html' })
    assert.equal(response.headers['x-early-flush'], undefined)
    assert.equal(response.body, `${prefix}${id}</main></body></html>`)
  }
})

test('explicit routes share their pattern key and force identity only for admitted requests', async t => {
  const { origin, seen } = await setup(t)
  await warm(origin)
  const hit = await get(origin, '/page/c?variant=1', { 'accept-encoding': 'br' })
  assert.equal(hit.headers['x-early-flush'], 'hit')
  assert.equal(hit.body, `${prefix}c</main></body></html>`)
  assert.deepEqual(seen, ['identity', 'identity', 'identity'])
  await get(origin, '/other', { 'accept-encoding': 'gzip' })
  await get(origin, '/page/d', { 'accept-encoding': 'br', range: 'bytes=0-10' })
  await get(origin, '/page/e', { 'accept-encoding': 'gzip', 'if-none-match': 'foo' })
  assert.deepEqual(seen.slice(3), ['gzip', 'br', 'gzip'])
})

test('empty routes and disabled early flush do not modify the request', async t => {
  for (const early of [{ ...earlyFlush, routes: [] }, { ...earlyFlush, enabled: false }]) {
    const { origin, seen } = await setup(t, { early })
    const response = await get(origin, '/page/a', { 'accept-encoding': 'gzip' })
    assert.equal(response.headers['x-early-flush'], undefined)
    assert.deepEqual(seen, ['gzip'])
  }
})

test('a custom key can bypass or isolate requests', async t => {
  for (const file of ['early-flush-key.js', 'early-flush-key-default.js']) {
    const { origin, seen } = await setup(t, {
      early: { ...earlyFlush, key: resolve(import.meta.dirname, 'fixtures', file) }
    })
    const bypass = await get(origin, '/page/a', { 'x-skip': 'yes', 'accept-encoding': 'gzip' })
    assert.equal(bypass.headers['x-early-flush'], 'bypass')
    assert.equal(seen[0], 'gzip')
    await warm(origin)
    const other = await get(origin, '/page/c', { 'accept-language': 'it' })
    assert.equal(other.headers['x-early-flush'], 'miss')
    const hit = await get(origin, '/page/d')
    assert.equal(hit.headers['x-early-flush'], 'hit')
  }
})

for (const encoding of ['identity', 'gzip', 'br']) {
  test(`sends a decodable ${encoding} prelude before upstream headers exist`, { timeout: 10000 }, async t => {
    const { origin, setRender } = await setup(t, { compression: encoding === 'identity' ? undefined : true })
    await warm(origin)
    const gate = Promise.withResolvers()
    const started = Promise.withResolvers()
    t.after(() => gate.resolve())
    setRender(async (req, reply) => {
      started.resolve()
      await gate.promise
      return reply.type('text/html').send(`${prefix}fresh</main></body></html>`)
    })
    const req = httpRequest(origin + '/page/c', { headers: { 'accept-encoding': encoding } })
    t.after(() => req.destroy())
    req.end()
    const [res] = await once(req, 'response')
    assert.equal(res.headers['x-early-flush'], 'hit')
    const decoded = encoding === 'identity' ? res : res.pipe(encoding === 'gzip' ? createGunzip() : createBrotliDecompress())
    let received = ''
    const first = Promise.withResolvers()
    decoded.on('data', chunk => {
      received += chunk.toString()
      if (received.includes(prefix)) {
        first.resolve()
      }
    })
    const ended = once(decoded, 'end')
    await started.promise
    await first.promise
    assert.equal(received, prefix)
    gate.resolve()
    await ended
    assert.equal(received, `${prefix}fresh</main></body></html>`)
  })
}

test('prefix mismatches terminate the hit and invalidate its generation', async t => {
  const { origin, setRender, logs } = await setup(t)
  await warm(origin)
  setRender((req, reply) => reply.type('text/html').send('<html><body>changed</body></html>'))
  await assert.rejects(get(origin, '/page/c'))
  assert.ok(logs.some(entry => entry.earlyFlush?.code === 'PLT_GATEWAY_EARLY_FLUSH_MISMATCH'))
  const response = await get(origin, '/page/d')
  assert.equal(response.headers['x-early-flush'], 'miss')
  assert.equal(response.body, '<html><body>changed</body></html>')
})

test('ineligible responses do not train', async t => {
  const { origin, setRender } = await setup(t)
  for (const headers of [{ 'set-cookie': 'session=1' }, { 'content-security-policy': "script-src 'nonce-secret'" }, { vary: '*' }, { 'content-encoding': 'gzip' }]) {
    setRender((req, reply) => reply.type('text/html').headers(headers).send(prefix))
    for (let i = 0; i < 3; i++) {
      const response = await get(origin, '/page/a')
      assert.equal(response.headers['x-early-flush'], 'miss')
    }
  }
})

test('early flush wraps both deduplication leaders and waiters', { timeout: 10000 }, async t => {
  const { origin, setRender } = await setup(t, { deduplication: { enabled: true, lockTtl: 5000, timeout: 5000 } })
  await warm(origin)
  const gate = Promise.withResolvers()
  t.after(() => gate.resolve())
  let calls = 0
  setRender(async (req, reply) => {
    calls++
    await gate.promise
    return reply.type('text/html').send(`${prefix}shared</main></body></html>`)
  })
  const responses = await Promise.all([request(origin + '/page/shared'), request(origin + '/page/shared')])
  for (const response of responses) {
    assert.equal(response.headers['x-early-flush'], 'hit')
  }
  const bodies = responses.map(async response => {
    const iterator = response.body[Symbol.asyncIterator]()
    const first = await iterator.next()
    assert.equal(first.value.toString(), prefix)
    return iterator
  })
  const iterators = await Promise.all(bodies)
  gate.resolve()
  for (const iterator of iterators) {
    let suffix = ''
    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
      suffix += chunk.toString()
    }
    assert.equal(suffix, 'shared</main></body></html>')
  }
  assert.equal(calls, 1)
})

for (const customKey of [false, true]) {
  test(`deduplication isolates identity producers from compressed bypasses (${customKey ? 'custom' : 'default'} key)`, { timeout: 10000 }, async t => {
    const gate = Promise.withResolvers()
    const entered = Promise.withResolvers()
    t.after(() => gate.resolve())
    const { origin, seen, logs, setRender } = await setup(t, {
      early: { ...earlyFlush, windowSize: 1, key: resolve(import.meta.dirname, 'fixtures/early-flush-key.js') },
      deduplication: {
        enabled: true,
        lockTtl: 5000,
        timeout: 5000,
        ...(customKey ? { key: resolve(import.meta.dirname, 'proxy/fixtures/deduplication-key.js') } : {})
      },
      handler: (req, reply) => reply.type('text/html').send(prefix)
    })
    await get(origin, '/page/warm')

    const html = `${prefix}shared</main></body></html>`
    setRender(async (req, reply) => {
      entered.resolve()
      await gate.promise
      reply.type('text/html')
      return req.headers['accept-encoding'] === 'gzip'
        ? reply.header('content-encoding', 'gzip').send(gzipSync(html))
        : reply.send(html)
    })

    // Hold the bypass leader upstream until the admitted client has received its early head.
    const bypass = request(origin + '/page/shared', { headers: { 'accept-encoding': 'gzip', 'x-skip': 'yes' } })
    await entered.promise
    const hit = await request(origin + '/page/shared', { headers: { 'accept-encoding': 'gzip' } })
    assert.equal(hit.headers['x-early-flush'], 'hit')
    gate.resolve()

    const leader = await bypass
    assert.equal(leader.headers['content-encoding'], 'gzip')
    assert.equal(gunzipSync(Buffer.from(await leader.body.arrayBuffer())).toString(), html)
    assert.equal(await hit.body.text(), html)
    assert.equal(hit.headers['content-encoding'], undefined)
    assert.deepEqual(seen, ['identity', 'gzip', 'identity'])
    assert.equal(logs.filter(entry => entry.earlyFlush?.type === 'invalidated').length, 0)
  })
}

test('incomplete learning streams do not promote', async t => {
  const { origin, setRender } = await setup(t, { early: { ...earlyFlush, windowSize: 1 } })
  setRender((req, reply) => {
    const stream = new PassThrough()
    stream.write(prefix)
    setImmediate(() => stream.destroy(new Error('upstream interrupted')))
    return reply.type('text/html').send(stream)
  })
  await assert.rejects(get(origin, '/page/a'))
  setRender((req, reply) => reply.type('text/html').send(prefix))
  const response = await get(origin, '/page/b')
  assert.equal(response.headers['x-early-flush'], 'miss')
})

test('HTML boundaries preserve original UTF-8 and exclude partial/raw/foreign tokens', () => {
  for (const tail of ['<script>unfinished', '<svg><path>', '<div title="unfinished', '<!-- unfinished']) {
    const source = Buffer.from('<html><body>é<div>' + tail)
    const safe = ensureSafePrefix(source, source.length)
    assert.equal(source.subarray(0, safe).toString(), '<html><body>é<div>')
  }
})

test('stale tickets cannot invalidate or repopulate replacement state', async () => {
  const sampler = new Sampler(resolveOptions({ memory: { maxKeys: 1 }, windowSize: 1, minPreludeBytes: 1, prefixPolicy: 'fifo', redirectPolicy: 'fifo' }))
  const storage = sampler.storage
  const request = { method: 'GET', headers: new Headers() }
  const { ticket: old } = await sampler.begin(request, 'a')
  await sampler.begin(request, 'b')
  const { ticket: current } = await sampler.begin(request, 'a')
  const state = await storage.get('a')
  assert.equal(await storage.invalidate(old.key, old.generation), false)
  await sampler.commit(old, { kind: 'html', status: 200, headers: [['content-type', 'text/html']], prefix: Buffer.from(prefix) })
  assert.deepEqual(await sampler.prelude(current), { result: 'miss' })
  assert.equal(await storage.get('a'), state)
  assert.equal(state.samples.size, 0)
})

test('gateway configuration accepts per-application early flush and resolves its key module', async t => {
  const upstream = Fastify()
  upstream.get('/page/:id', (req, reply) => reply.type('text/html').send(`${prefix}${req.params.id}</main></body></html>`))
  const url = await upstream.listen({ host: '127.0.0.1', port: 0 })
  t.after(() => upstream.close())
  const instance = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{
        id: 'upstream',
        proxy: {
          prefix: '/',
          upstream: url,
          earlyFlush: {
            ...earlyFlush,
            key: resolve(import.meta.dirname, 'fixtures/early-flush-key.js')
          }
        }
      }]
    }
  })
  const origin = await instance.start({ listen: true })
  await warm(origin)
  assert.equal((await get(origin, '/page/c')).headers['x-early-flush'], 'hit')
})

for (const change of ['short-body', 'status', 'headers', 'compressed']) {
  test(`${change} invalidates a promoted response`, async t => {
    const { origin, setRender } = await setup(t)
    await warm(origin)
    setRender((req, reply) => {
      reply.type('text/html')
      if (change === 'status') {
        reply.code(201)
      } else if (change === 'headers') {
        reply.header('content-language', 'it')
      } else if (change === 'compressed') {
        reply.header('content-encoding', 'gzip')
      }
      return reply.send(change === 'short-body' ? prefix.slice(0, 20) : prefix)
    })
    await assert.rejects(get(origin, '/page/c'))
    assert.equal((await get(origin, '/page/d')).headers['x-early-flush'], 'miss')
  })
}

test('upstream errors do not invalidate an otherwise valid prelude', async t => {
  const { origin, setRender, logs } = await setup(t)
  await warm(origin)
  setRender((req, reply) => reply.code(500).send('failed'))
  await assert.rejects(get(origin, '/page/c'))
  assert.ok(logs.some(entry => entry.earlyFlush?.code === 'PLT_GATEWAY_EARLY_FLUSH_UPSTREAM_ERROR'))
  setRender((req, reply) => reply.type('text/html').send(prefix + 'restored'))
  const response = await get(origin, '/page/d')
  assert.equal(response.headers['x-early-flush'], 'hit')
  assert.equal(response.body, prefix + 'restored')
})

test('HEAD and excluded methods retain normal response semantics', async t => {
  const { origin, seen } = await setup(t, { early: { ...earlyFlush, routes: [{ methods: ['GET', 'HEAD'], path: '/page/:id' }] } })
  await warm(origin)
  const response = await request(origin + '/page/a', { method: 'HEAD' })
  assert.equal(response.headers['x-early-flush'], 'bypass')
  assert.equal(await response.body.text(), '')
  const posted = await request(origin + '/page/a', { method: 'POST', headers: { 'accept-encoding': 'br' } })
  await posted.body.dump()
  assert.equal(posted.headers['x-early-flush'], undefined)
  assert.equal(seen.at(-1), 'br')
})

test('disconnecting a leader during a hit does not cancel the shared response for its waiter', { timeout: 10000 }, async t => {
  const { origin, setRender } = await setup(t, { deduplication: { enabled: true, lockTtl: 5000, timeout: 5000 } })
  await warm(origin)
  const gate = Promise.withResolvers()
  const started = Promise.withResolvers()
  t.after(() => gate.resolve())
  let calls = 0
  setRender(async (req, reply) => {
    calls++
    started.resolve()
    await gate.promise
    return reply.type('text/html').send(prefix + 'completed')
  })
  const leader = httpRequest(origin + '/page/shared')
  t.after(() => leader.destroy())
  leader.end()
  const [response] = await once(leader, 'response')
  await once(response, 'data')
  await started.promise
  const waiter = await request(origin + '/page/shared')
  const closed = once(response, 'close')
  response.destroy()
  await closed
  gate.resolve()
  assert.equal(await waiter.body.text(), prefix + 'completed')
  assert.equal(calls, 1)
})

test('late redirect policy is retained across later learning responses', async t => {
  const { origin, setRender } = await setup(t)
  await warm(origin)
  setRender((req, reply) => reply.redirect('/login'))
  await assert.rejects(get(origin, '/page/c'))
  setRender((req, reply) => reply.type('text/html').send(prefix + 'restored'))
  for (let i = 0; i < 4; i++) {
    assert.equal((await get(origin, '/page/d')).headers['x-early-flush'], 'miss')
  }
})

test('FIFO forgets old prefix constraints while conservative learning retains them', async () => {
  for (const policy of ['fifo', 'conservative']) {
    const config = resolveOptions({ memory: { maxKeys: 1 }, windowSize: 2, minPreludeBytes: 32, prefixPolicy: policy, redirectPolicy: 'fifo' })
    const sampler = new Sampler(config)
    const { ticket } = await sampler.begin({ method: 'GET', headers: new Headers() }, 'GET /page/:id')
    const commit = text => sampler.commit(ticket, { kind: 'html', status: 200, headers: [['content-type', 'text/html']], prefix: Buffer.from(text) })
    await commit('<div>unrelated</div>')
    await commit(prefix + 'a')
    await commit(prefix + 'b')
    assert.equal((await sampler.prelude(ticket)).result, policy === 'fifo' ? 'hit' : 'miss')
    if (policy === 'fifo') {
      const { prelude: prepared } = await sampler.prelude(ticket)
      await commit('<p>late learning request</p>')
      assert.equal((await sampler.prelude(ticket)).prelude, prepared)
    }
  }
})

test('invalid prefix limits fail startup with a gateway error code', async t => {
  await assert.rejects(setup(t, { early: { ...earlyFlush, minPreludeBytes: 100, maxPrefixBytes: 10 } }), {
    code: 'PLT_GATEWAY_EARLY_FLUSH_INVALID_OPTION'
  })
})

test('verification strips a prefix split across arbitrary upstream chunks', async t => {
  const { origin, setRender } = await setup(t)
  await warm(origin)
  setRender((req, reply) => {
    const stream = new PassThrough()
    const chunks = [prefix.slice(0, 1), prefix.slice(1, 17), prefix.slice(17), 'fresh suffix']
    async function write () {
      for (const chunk of chunks) {
        stream.write(chunk)
        await new Promise(resolve => setImmediate(resolve))
      }
      stream.end()
    }
    write().catch(error => stream.destroy(error))
    return reply.type('text/html').send(stream)
  })
  const response = await get(origin, '/page/c')
  assert.equal(response.headers['x-early-flush'], 'hit')
  assert.equal(response.body, prefix + 'fresh suffix')
})

test('a disconnected hit disposes of a late upstream body without invalidating the prelude', { timeout: 10000 }, async t => {
  const { origin, setRender, logs } = await setup(t)
  await warm(origin)
  const gate = Promise.withResolvers()
  const closed = Promise.withResolvers()
  t.after(() => gate.resolve())
  setRender(async (req, reply) => {
    await gate.promise
    const stream = new PassThrough()
    stream.once('close', closed.resolve)
    stream.write(prefix)
    return reply.type('text/html').send(stream)
  })
  const req = httpRequest(origin + '/page/c')
  t.after(() => req.destroy())
  req.end()
  const [response] = await once(req, 'response')
  await once(response, 'data')
  response.destroy()
  gate.resolve()
  await closed.promise
  assert.equal(logs.filter(entry => entry.earlyFlush?.type === 'cancelled').length, 1)
  assert.equal(logs.filter(entry => entry.earlyFlush?.type === 'invalidated').length, 0)
})

test('legacy custom handlers can send responses and delegate to reply.from', async t => {
  const { origin } = await setup(t, { gatewayHandler: resolve(import.meta.dirname, 'fixtures/early-flush-handler.js') })
  assert.equal((await get(origin, '/page/a')).body, `${prefix}a</main></body></html>`)
  const response = await get(origin, '/page/c', { 'x-custom': 'yes' })
  assert.equal(response.headers['x-early-flush'], undefined)
  assert.equal(response.headers['content-type'], 'text/html')
  assert.equal(response.body, prefix + 'custom')
  const changed = await get(origin, '/page/d', { 'x-custom': 'yes', 'x-change-type': 'yes' })
  assert.equal(changed.headers['content-type'], 'text/plain')
  assert.equal(changed.body, prefix + 'custom')
})

test('custom response producers opt into early flush with and without deduplication', async t => {
  for (const deduplication of [undefined, { enabled: true }]) {
    const { origin } = await setup(t, {
      deduplication,
      gatewayHandler: resolve(import.meta.dirname, 'fixtures/early-flush-producer.js')
    })
    await warm(origin)
    const response = await get(origin, '/page/c')
    assert.equal(response.headers['x-early-flush'], 'hit')
    assert.equal(response.body, `${prefix}c</main></body></html>`)
    assert.equal((await get(origin, '/other')).body, 'legacy')
  }
})

test('application deduplication disable overrides global enable for custom producers', async t => {
  const { origin, logs } = await setup(t, {
    deduplication: { enabled: true },
    proxyOptions: { deduplication: { enabled: false } },
    gatewayHandler: resolve(import.meta.dirname, 'fixtures/early-flush-producer.js')
  })
  await warm(origin)
  const response = await get(origin, '/page/c')
  assert.equal(response.status, 200)
  assert.equal(response.headers['x-early-flush'], 'hit')
  assert.equal(response.body, `${prefix}c</main></body></html>`)
  assert.equal((await get(origin, '/other')).body, 'legacy')
  assert.equal(logs.some(entry => entry.err || entry.error), false)
})

test('learning preserves hook and upstream cookies exactly once and does not promote them', async t => {
  const { origin } = await setup(t, {
    onRequest: async (req, reply) => { reply.header('set-cookie', 'hook=1') },
    handler: (req, reply) => reply.type('text/html').header('set-cookie', ['upstream=1', 'other=2']).send(prefix)
  })
  for (let i = 0; i < 3; i++) {
    const response = await get(origin, '/page/a')
    assert.equal(response.headers['x-early-flush'], 'miss')
    assert.deepEqual(response.headers['set-cookie'], ['hook=1', 'upstream=1', 'other=2'])
  }
})

test('response transport preserves rewritten paths, queries and forwarded headers', async t => {
  let upstreamRequest
  const { origin } = await setup(t, {
    proxyOptions: { prefix: '/site' },
    early: { ...earlyFlush, routes: [{ method: 'GET', path: '/site/page/:id' }] },
    handler: (req, reply) => {
      upstreamRequest = { url: req.url, headers: req.headers }
      return reply.type('text/html').send(prefix)
    }
  })
  for (const decision of ['miss', 'miss', 'hit']) {
    const incoming = await new Promise((resolve, reject) => {
      const req = httpRequest(`${origin}/site/page/a?name=a%2Fb&name=c`, {
        headers: { connection: 'x-remove', 'x-remove': 'private' }
      }, resolve)
      req.on('error', reject)
      req.end()
    })
    let body = ''
    for await (const chunk of incoming) {
      body += chunk.toString()
    }
    assert.equal(incoming.statusCode, 200)
    assert.equal(upstreamRequest.url, '/page/a?name=a%2Fb&name=c')
    assert.equal(upstreamRequest.headers['x-forwarded-host'], new URL(origin).host)
    assert.equal(upstreamRequest.headers['accept-encoding'], 'identity')
    assert.equal(upstreamRequest.headers['x-remove'], undefined)
    assert.equal(body, prefix)
    assert.equal(incoming.headers['x-early-flush'], decision)
  }
})

test('hook cookies alone prevent response promotion', async t => {
  const { origin } = await setup(t, {
    onRequest: async (request, reply) => { reply.header('set-cookie', 'hook=1') }
  })
  for (const id of ['a', 'b', 'c']) {
    const response = await get(origin, `/page/${id}`)
    assert.equal(response.headers['x-early-flush'], 'miss')
    assert.equal(response.headers['set-cookie'], 'hook=1')
  }
})

test('response transport retries a transient upstream 503 before learning', async t => {
  let attempts = 0
  const { origin } = await setup(t, {
    handler: (request, reply) => {
      if (attempts++ === 0) {
        return reply.code(503).header('retry-after', '1').send('retry')
      }
      return reply.type('text/html').send(prefix)
    }
  })
  const response = await get(origin, '/page/a')
  assert.equal(attempts, 2)
  assert.equal(response.status, 200)
  assert.equal(response.body, prefix)
})

test('parsed QUERY JSON bodies retain their wire representation and byte length', async t => {
  const received = []
  const { origin } = await setup(t, {
    proxyOptions: { proxyPayloads: false, methods: ['QUERY'] },
    early: { ...earlyFlush, routes: [{ method: 'QUERY', path: '/page/:id' }] },
    handler: (req, reply) => {
      received.push(req.body)
      return reply.type('text/html').send(prefix)
    }
  })
  for (const payload of ['search term', 'caffè ☕', '', 42, false, null, { query: 'term' }, ['term']]) {
    const response = await request(origin + '/page/search', {
      method: 'QUERY',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    })
    assert.equal(response.statusCode, 200)
    assert.equal(await response.body.text(), prefix)
    assert.deepEqual(received.at(-1), payload)
  }
})

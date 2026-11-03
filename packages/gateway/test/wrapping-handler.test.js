import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createBrotliDecompress, createGunzip } from 'node:zlib'
import Fastify from 'fastify'
import { create, platformaticGateway } from '../index.js'
import { prefix, states } from './proxy/fixtures/wrapping-handler.js'

const body = '<html><body>Fresh response</body></html>'

async function setup (t, { render, compression, deduplication = true, fixture = 'wrapping-handler.js' }) {
  const upstream = Fastify({ forceCloseConnections: true })
  t.after(() => upstream.close())
  let requests = 0
  upstream.get('/page', (req, reply) => {
    requests++
    return render(req, reply)
  })
  const origin = await upstream.listen({ host: '127.0.0.1', port: 0 })
  const state = { outer: 0, inner: 0, responses: [], errors: 0, traces: 0, sends: new Map() }
  const gateway = await create(resolve(import.meta.dirname, '..'), {
    server: { hostname: '127.0.0.1', port: 0, logger: { level: 'silent' }, forceCloseConnections: true },
    gateway: {
      handler: resolve(import.meta.dirname, 'proxy/fixtures', fixture),
      compression: compression ? { enabled: true, threshold: 0, encodings: [compression] } : false,
      deduplication: { enabled: deduplication, lockTtl: 10000, timeout: 10000 },
      applications: [{ id: 'frontend', origin, proxy: { prefix: '/' } }]
    },
    watch: false
  }, {
    isStandalone: true,
    isEntrypoint: true,
    applicationFactory: async (app, capability) => {
      app.decorate('openTelemetry', {
        startHTTPSpanClient: () => ({ span: {}, telemetryHeaders: {} }),
        endHTTPSpanClient: () => {
          state.traces++
        }
      })
      app.addHook('onSend', async (request, _reply, payload) => {
        const client = request.headers['x-client']
        state.sends.set(client, (state.sends.get(client) ?? 0) + 1)
        return payload
      })
      await platformaticGateway(app, capability)
    }
  })
  t.after(() => gateway.stop())
  await gateway.init()
  await gateway.start()
  const address = gateway.getApplication().listeningOrigin
  states.set(address, state)
  t.after(() => states.delete(address))

  return { address, state, requests: () => requests }
}

function client (t, address, id, encoding, bypass = false) {
  const first = Promise.withResolvers()
  const done = Promise.withResolvers()
  first.promise.catch(() => {})
  done.promise.catch(() => {})
  const req = request(address + '/page', {
    headers: { 'x-client': id, 'accept-encoding': encoding ?? 'identity', ...(bypass ? { 'x-bypass': 'yes' } : {}) }
  })
  t.after(() => req.destroy())
  req.on('error', error => {
    first.reject(error)
    done.reject(error)
  })
  req.on('response', response => {
    const input = encoding === 'gzip'
      ? response.pipe(createGunzip())
      : encoding === 'br' ? response.pipe(createBrotliDecompress()) : response
    const chunks = []
    input.on('data', chunk => {
      chunks.push(chunk)
      first.resolve(chunk.toString())
    })
    input.on('end', () => done.resolve({ body: Buffer.concat(chunks).toString(), headers: response.headers }))
    input.on('error', error => {
      first.reject(error)
      done.reject(error)
    })
    response.on('error', error => {
      first.reject(error)
      done.reject(error)
    })
  })
  req.end()
  return { req, first: first.promise, done: done.promise }
}

for (const encoding of [undefined, 'gzip', 'br']) {
  for (const cancel of [false, true]) {
    test(`outer wrapper preserves replay metadata (${encoding ?? 'identity'}, cancel leader ${cancel})`, { timeout: 10000 }, async t => {
      const release = Promise.withResolvers()
      t.after(() => release.resolve())
      const { address, state, requests } = await setup(t, {
        compression: encoding,
        render: async (req, reply) => {
          assert.equal(req.headers['accept-encoding'], 'identity')
          await release.promise
          return reply.type('text/html').send(body)
        }
      })
      const leader = client(t, address, 'leader', encoding)
      assert.equal(await leader.first, prefix)
      const waiter = client(t, address, 'waiter', encoding)
      assert.equal(await waiter.first, prefix)
      assert.equal(state.outer, 2)
      assert.equal(state.inner, 1)
      assert.equal(state.traces, 0)

      // Release the upstream only after both clients have decoded the early output.
      if (cancel) {
        const closed = once(leader.req, 'close')
        leader.req.destroy()
        await closed
      }
      release.resolve()
      if (!cancel) {
        assert.equal((await leader.done).body, prefix + body)
      }
      const response = await waiter.done
      assert.equal(response.body, prefix + body)
      assert.equal(response.headers['content-encoding'], encoding)
      assert.equal(requests(), 1)
      assert.equal(state.traces, 1)
      assert.equal(state.sends.get('leader'), 1)
      assert.equal(state.sends.get('waiter'), 1)
      assert.equal(state.responses.length, 2)
      for (const response of state.responses) {
        assert.equal(response.headers['content-encoding'], undefined)
        assert.equal(response.headers['content-length'], String(Buffer.byteLength(body)))
      }
    })
  }
}

test('wrapper works without deduplication and preserves ordinary bypass', async t => {
  const { address, state } = await setup(t, {
    compression: 'gzip',
    deduplication: false,
    render: (_req, reply) => reply.type('text/html').send(body)
  })
  assert.equal((await client(t, address, 'wrapped', 'gzip').done).body, prefix + body)
  assert.equal((await client(t, address, 'bypass', 'gzip', true).done).body, body)
  assert.equal(state.inner, 2)
  assert.equal(state.sends.get('wrapped'), 1)
  assert.equal(state.sends.get('bypass'), 1)
})

test('late upstream transport error terminates the existing output once', { timeout: 10000 }, async t => {
  const release = Promise.withResolvers()
  t.after(() => release.resolve())
  const { address, state } = await setup(t, {
    render: async (_req, reply) => {
      await release.promise
      reply.raw.destroy()
      return reply
    }
  })
  const connection = client(t, address, 'leader')
  assert.equal(await connection.first, prefix)
  release.resolve()
  await assert.rejects(connection.done)
  assert.equal(state.errors, 1)
  assert.equal(state.sends.get('leader'), 1)
})

for (const fixture of ['invalid-wrapping-handler.js', 'invalid-wrapped-handler.js']) {
  test(`rejects ${fixture} at startup`, async t => {
    await assert.rejects(setup(t, { fixture, render: (_req, reply) => reply.send(body) }), {
      code: 'PLT_GATEWAY_INVALID_WRAPPING_HANDLER'
    })
  })
}

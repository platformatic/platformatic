import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import Fastify from 'fastify'
import { create } from '../index.js'
import { events } from './proxy/fixtures/headers-override-wrapper.js'

async function setup (t, options = {}, gate) {
  const upstream = Fastify()
  t.after(() => upstream.close())
  const requests = []
  upstream.get('/page', async (request, reply) => {
    requests.push(request.headers)
    await gate
    reply.header('set-cookie', 'upstream=original')
    return { value: request.headers['x-override'] }
  })
  const origin = await upstream.listen({ host: '127.0.0.1', port: 0 })
  const gateway = await create(resolve(import.meta.dirname, '..'), {
    server: { logger: { level: 'silent' } },
    gateway: {
      wrappingHandler: resolve(import.meta.dirname, 'proxy/fixtures/headers-override-wrapper.js'),
      deduplication: { enabled: true, lockTtl: 10000, timeout: 10000 },
      applications: [{
        id: 'frontend',
        origin,
        proxy: {
          prefix: '/',
          custom: { path: resolve(import.meta.dirname, 'proxy/fixtures/headers-override.js'), options }
        }
      }]
    },
    watch: false
  }, { isStandalone: true, isEntrypoint: true })
  t.after(() => gateway.stop())
  await gateway.init()
  return { app: gateway.getApplication(), requests }
}

for (const async of [false, true]) {
  test(`header overrides run after validation and before wrappers (async=${async})`, async t => {
    const { app, requests } = await setup(t, { async, cookie: true })
    for (const client of ['first', 'second']) {
      const response = await app.inject({ url: '/page', headers: { 'x-client': client, 'x-override': 'original' } })
      assert.equal(response.statusCode, 200)
      assert.equal(response.headers['x-wrapper-request'], 'validated')
      assert.equal(response.headers['x-client'], client)
      assert.deepEqual(response.headers['set-cookie'], [
        `session=${client}; Path=/; HttpOnly`, `variant=${client}; Path=/`
      ])
      assert.deepEqual(response.json(), { value: 'validated' })
    }
    assert.deepEqual(requests.map(request => request.cookie), ['session=first', 'session=second'])
  })
}

for (const name of ['getUpstream', 'rewriteHeaders', 'onError', 'getHeadersOverride', 'preRewrite', 'preValidation']) {
  test(`rejects a non-function custom ${name} at startup`, async t => {
    await assert.rejects(setup(t, { invalidHandler: name }), {
      code: 'PLT_GATEWAY_INVALID_CUSTOM_HANDLER',
      message: `Custom proxy handler "${name}" must be a function.`
    })
  })
}

test('response overrides stay per-client on deduplicated replay, including clients with no overrides', async t => {
  const gate = Promise.withResolvers()
  t.after(() => gate.resolve())
  const { app, requests } = await setup(t, {}, gate.promise)
  const arrived = Promise.withResolvers()
  let count = 0
  const onRequest = () => {
    if (++count === 3) {
      arrived.resolve()
    }
  }
  events.on('request', onRequest)
  t.after(() => events.off('request', onRequest))
  const clients = ['leader', 'waiter', 'none']
  const responses = clients.map(client => app.inject({ url: '/page', headers: { 'x-client': client } }))
  await arrived.promise
  await setImmediate()
  gate.resolve()
  for (const [index, response] of (await Promise.all(responses)).entries()) {
    const client = clients[index]
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['x-client'], client === 'none' ? 'rewritten' : client)
    assert.deepEqual(response.headers['set-cookie'], client === 'none'
      ? ['upstream=rewritten; Path=/']
      : [`session=${client}; Path=/; HttpOnly`, `variant=${client}; Path=/`])
  }
  assert.equal(requests.length, 1)
})

test('a wrapper can send the prepared response headers before acquiring upstream', async t => {
  const { app, requests } = await setup(t)
  const response = await app.inject({ url: '/page', headers: { 'x-client': 'early', 'x-early': 'true' } })
  assert.equal(response.body, 'early')
  assert.equal(response.headers['x-client'], 'early')
  assert.deepEqual(response.headers['set-cookie'], ['session=early; Path=/; HttpOnly', 'variant=early; Path=/'])
  assert.equal(requests.length, 0)
})

test('invalid header overrides fail before upstream acquisition with a stable error code', async t => {
  const { app, requests } = await setup(t, { invalid: true })
  const response = await app.inject('/page')
  assert.equal(response.statusCode, 500)
  assert.equal(response.json().code, 'PLT_GATEWAY_INVALID_HEADERS_OVERRIDE')
  assert.equal(requests.length, 0)
})

import Swagger from '@fastify/swagger'
import fastify from 'fastify'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

// An upstream that documents strict schemas but never enforces them, so that
// whether a request reached it (and with which payload) is observable.
async function createLenientUpstream (t) {
  const app = fastify({ logger: false, keepAliveTimeout: 10, forceCloseConnections: true })
  const received = []

  await app.register(Swagger, { openapi: { info: { title: 'Lenient', version: '0.1.0' } } })
  app.get('/documentation/json', { schema: { hide: true } }, async () => app.swagger())

  const lenient = {
    validatorCompiler: () => () => true,
    serializerCompiler: () => JSON.stringify
  }

  app.post(
    '/echo',
    {
      ...lenient,
      schema: {
        body: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string' } } },
        response: { 200: { type: 'object', properties: { name: { type: 'string' } } } }
      }
    },
    async req => {
      received.push({ url: req.url, body: req.body })
      return req.body
    }
  )

  app.get(
    '/items',
    {
      ...lenient,
      schema: {
        querystring: { type: 'object', properties: { limit: { type: 'integer' } } },
        response: { 200: { type: 'object', properties: { limit: { type: 'integer' } } } }
      }
    },
    async req => {
      received.push({ url: req.url, query: { ...req.query } })
      return { limit: req.query.limit }
    }
  )

  // Documents a required header with an uppercase name.
  app.get(
    '/secure',
    {
      ...lenient,
      schema: {
        headers: { type: 'object', required: ['X-Token'], properties: { 'X-Token': { type: 'string' } } },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } }
      }
    },
    async () => ({ ok: true })
  )

  // Answers with a status and a shape the specification does not document.
  app.get(
    '/reject',
    { ...lenient, schema: { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
    async (req, reply) => {
      reply.code(422)
      return { problems: ['name is taken'], hint: 1 }
    }
  )

  // The response carries a property the schema does not document: the proxy
  // streams it as it is.
  app.get(
    '/extra',
    {
      ...lenient,
      schema: { response: { 200: { type: 'object', properties: { id: { type: 'number' } } } } }
    },
    async () => ({ id: 1, extra: 'kept' })
  )

  t.after(() => app.close())
  await app.listen({ port: 0 })

  return { origin: 'http://127.0.0.1:' + app.server.address().port, received }
}

async function createGateway (t, origin, openapi, plugins) {
  return createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{ id: 'api1', origin, openapi: { url: '/documentation/json', ...openapi } }]
    },
    plugins
  })
}

test('validation defaults to "full": invalid requests are rejected by the gateway', async t => {
  const upstream = await createLenientUpstream(t)
  const gateway = await createGateway(t, upstream.origin, {})

  {
    // fastify's ajv coerces scalars (42 -> "42"), so use a payload no coercion can rescue.
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/echo', payload: { name: { nested: true } } })
    assert.equal(statusCode, 400)
    assert.equal(JSON.parse(body).code, 'FST_ERR_VALIDATION')
  }

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/items?limit=abc' })
    assert.equal(statusCode, 400)
  }

  assert.deepEqual(upstream.received, [], 'the upstream never sees the invalid requests')

  // Positive control: a valid request still goes through.
  const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/echo', payload: { name: 'ok' } })
  assert.equal(statusCode, 200)
  assert.deepEqual(JSON.parse(body), { name: 'ok' })
})

test('validation: "none" forwards invalid requests to the upstream as they are', async t => {
  const upstream = await createLenientUpstream(t)
  const gateway = await createGateway(t, upstream.origin, { validation: 'none' })

  {
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/echo', payload: { name: { nested: true } } })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { name: { nested: true } })
  }

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/items?limit=abc' })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { limit: 'abc' }, 'no coercion happens at the gateway')
  }

  assert.deepEqual(upstream.received, [
    { url: '/echo', body: { name: { nested: true } } },
    { url: '/items?limit=abc', query: { limit: 'abc' } }
  ])
})

test('validation: "none" keeps the fields query splitting and the prefix mapping', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  const seen = []
  api.addHook('onRequest', async req => {
    if (!req.url.startsWith('/documentation/')) {
      seen.push(req.url)
    }
  })
  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: { url: '/documentation/json', prefix: '/internal', validation: 'none' }
        }
      ]
    },
    plugins: {
      paths: [join(import.meta.dirname, './fixtures/plugins/fields.js')]
    }
  })

  const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/internal/users/1?fields=id,name' })
  assert.equal(statusCode, 200)
  assert.deepEqual(JSON.parse(body), { fields: ['id', 'name'] }, 'fields is still split at the gateway')
  assert.deepEqual(seen, ['/users/1?fields=id,name'], 'the prefix is stripped and the raw query forwarded')
})

for (const format of ['json', 'yaml']) {
  test(`the composed OpenAPI document (${format}) is identical in both validation modes`, async t => {
    const upstream = await createLenientUpstream(t)
    const full = await createGateway(t, upstream.origin, {})
    const none = await createGateway(t, upstream.origin, { validation: 'none' })

    const fullDocument = await full.inject({ method: 'GET', url: `/documentation/${format}` })
    const noneDocument = await none.inject({ method: 'GET', url: `/documentation/${format}` })

    assert.equal(fullDocument.statusCode, 200)
    assert.equal(noneDocument.statusCode, 200)
    assert.equal(noneDocument.body, fullDocument.body)

    // Positive control: the document still describes the request schemas.
    assert.ok(fullDocument.body.includes('/echo'), 'the operations are documented')
  })
}

for (const openapi of [{}, { validation: 'none' }]) {
  test(`the upstream response is proxied unchanged (${JSON.stringify(openapi)})`, async t => {
    const upstream = await createLenientUpstream(t)
    const gateway = await createGateway(t, upstream.origin, openapi)

    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/extra' })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { id: 1, extra: 'kept' })
  })
}

test('validation is a per-application setting', async t => {
  const strict = await createLenientUpstream(t)
  const lenient = await createLenientUpstream(t)

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [
        { id: 'strict', origin: strict.origin, openapi: { url: '/documentation/json', prefix: '/strict' } },
        { id: 'lenient', origin: lenient.origin, openapi: { url: '/documentation/json', prefix: '/lenient', validation: 'none' } }
      ]
    }
  })

  const payload = { name: { nested: true } }

  {
    const { statusCode } = await gateway.inject({ method: 'POST', url: '/strict/echo', payload })
    assert.equal(statusCode, 400)
    assert.deepEqual(strict.received, [])
  }

  {
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/lenient/echo', payload })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), payload)
    assert.deepEqual(lenient.received, [{ url: '/echo', body: payload }])
  }
})

test('validation: "none" returns the upstream status and body unchanged', async t => {
  const upstream = await createLenientUpstream(t)
  const gateway = await createGateway(t, upstream.origin, { validation: 'none' })

  const direct = await request(upstream.origin + '/reject')
  const directBody = await direct.body.text()
  assert.equal(direct.statusCode, 422)

  const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/reject' })
  assert.equal(statusCode, 422, 'the undocumented status is passed through')
  assert.equal(body, directBody)
})

test('no validator is compiled for the routes of a "none" application', async t => {
  const strict = await createLenientUpstream(t)
  const lenient = await createLenientUpstream(t)

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [
        { id: 'strict', origin: strict.origin, openapi: { url: '/documentation/json', prefix: '/strict' } },
        { id: 'lenient', origin: lenient.origin, openapi: { url: '/documentation/json', prefix: '/lenient', validation: 'none' } }
      ]
    },
    plugins: {
      paths: [{ path: join(import.meta.dirname, './fixtures/plugins/recording-validator.js'), encapsulate: false }]
    }
  })
  await gateway.start({ listen: false })

  const compiles = globalThis.recordedValidatorCompiles
  delete globalThis.recordedValidatorCompiles

  assert.ok(compiles.length > 0, 'validators are compiled at startup for the "full" application')
  assert.ok(compiles.includes('/strict/echo body'))
  assert.deepEqual(compiles.filter(entry => entry.startsWith('/lenient')), [], 'none for the "none" application')
})

test('a required header documented with an uppercase name', async t => {
  const upstream = await createLenientUpstream(t)
  const full = await createGateway(t, upstream.origin, {})
  const none = await createGateway(t, upstream.origin, { validation: 'none' })

  for (const headers of [{ 'x-token': 't' }, { 'X-Token': 't' }]) {
    for (const gateway of [full, none]) {
      const { statusCode } = await gateway.inject({ method: 'GET', url: '/secure', headers })
      assert.equal(statusCode, 200, `present header ${JSON.stringify(headers)}`)
    }
  }

  const missingFull = await full.inject({ method: 'GET', url: '/secure' })
  assert.equal(missingFull.statusCode, 400)
  assert.match(missingFull.body, /required property 'x-token'/)

  const missingNone = await none.inject({ method: 'GET', url: '/secure' })
  assert.equal(missingNone.statusCode, 200, 'not validated at the gateway')
})

test('an additional property is stripped in "full" and forwarded in "none"', async t => {
  const payload = { name: 'x', extra: 1 }

  {
    // Observed on 3.68.0: fastify's default ajv options remove additional
    // properties instead of rejecting the body.
    const upstream = await createLenientUpstream(t)
    const gateway = await createGateway(t, upstream.origin, {})
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/echo', payload })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { name: 'x' })
    assert.deepEqual(upstream.received, [{ url: '/echo', body: { name: 'x' } }], 'the extra property never reaches the upstream')
  }

  {
    const upstream = await createLenientUpstream(t)
    const gateway = await createGateway(t, upstream.origin, { validation: 'none' })
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/echo', payload })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), payload)
    assert.deepEqual(upstream.received, [{ url: '/echo', body: payload }], 'the body is forwarded untouched')
  }
})

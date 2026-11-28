import fastify from 'fastify'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFromConfig } from '../helper.js'

const fileBody = {
  type: 'object',
  required: ['file'],
  properties: { file: { type: 'string', format: 'binary' } }
}

const nameBody = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: { name: { type: 'string' } }
}

const echoResponse = {
  description: 'What the upstream received',
  content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
}

// An upstream that documents the request bodies of its operations and
// answers with what it received, the body read as it was sent.
async function createUpstream (t) {
  const app = fastify({ logger: false, keepAliveTimeout: 10, forceCloseConnections: true })
  const received = []

  const document = {
    openapi: '3.0.3',
    info: { title: 'Uploads', version: '1.0.0' },
    paths: {
      '/upload': {
        post: {
          parameters: [{ name: 'size', in: 'query', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'multipart/form-data': { schema: fileBody } } },
          responses: { 200: echoResponse }
        }
      },
      '/binary': {
        put: {
          requestBody: {
            required: true,
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }
          },
          responses: { 200: echoResponse }
        }
      },
      '/either': {
        post: {
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: nameBody },
              'multipart/form-data; charset=utf-8': { schema: fileBody }
            }
          },
          responses: { 200: echoResponse }
        }
      }
    }
  }

  app.get('/documentation/json', async () => document)

  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => done(null, body))

  const echo = async req => {
    received.push(req.url)
    return { contentType: req.headers['content-type'], body: req.body }
  }
  app.post('/upload', echo)
  app.put('/binary', echo)
  app.post('/either', echo)

  t.after(() => app.close())
  await app.listen({ port: 0 })

  return { origin: 'http://127.0.0.1:' + app.server.address().port, received }
}

async function createGateway (t, origin) {
  return createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{ id: 'api', origin, openapi: { url: '/documentation/json' } }]
    }
  })
}

const boundary = '----platformatic-passthrough-test'
const multipartBody = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="file"; filename="package.tgz"',
  'Content-Type: application/gzip',
  '',
  'file content',
  `--${boundary}--`,
  ''
].join('\r\n')
const multipartContentType = `multipart/form-data; boundary=${boundary}`

test('a request body of a pass-through content type is forwarded, not validated', async t => {
  const upstream = await createUpstream(t)
  const gateway = await createGateway(t, upstream.origin)

  {
    const { statusCode, body } = await gateway.inject({
      method: 'POST',
      url: '/upload?size=12',
      headers: { 'content-type': multipartContentType },
      payload: multipartBody
    })
    assert.equal(statusCode, 200, body)
    assert.deepEqual(JSON.parse(body), { contentType: multipartContentType, body: multipartBody })
  }

  {
    const { statusCode, body } = await gateway.inject({
      method: 'PUT',
      url: '/binary',
      headers: { 'content-type': 'application/octet-stream' },
      payload: 'bytes'
    })
    assert.equal(statusCode, 200, body)
    assert.deepEqual(JSON.parse(body), { contentType: 'application/octet-stream', body: 'bytes' })
  }

  assert.deepEqual(upstream.received, ['/upload?size=12', '/binary'])
})

test('the parameters of an operation with a pass-through request body are still validated', async t => {
  const upstream = await createUpstream(t)
  const gateway = await createGateway(t, upstream.origin)

  const { statusCode, body } = await gateway.inject({
    method: 'POST',
    url: '/upload?size=large',
    headers: { 'content-type': multipartContentType },
    payload: multipartBody
  })
  assert.equal(statusCode, 400)
  assert.equal(JSON.parse(body).code, 'FST_ERR_VALIDATION')
  assert.deepEqual(upstream.received, [], 'the upstream never sees the invalid request')
})

test('an operation that also accepts a parsed media type validates only the body of that type', async t => {
  const upstream = await createUpstream(t)
  const gateway = await createGateway(t, upstream.origin)

  {
    const { statusCode, body } = await gateway.inject({
      method: 'POST',
      url: '/either',
      payload: { name: { nested: true } }
    })
    assert.equal(statusCode, 400)
    assert.equal(JSON.parse(body).code, 'FST_ERR_VALIDATION')
  }

  {
    const { statusCode, body } = await gateway.inject({ method: 'POST', url: '/either', payload: { name: 'ok' } })
    assert.equal(statusCode, 200, body)
    assert.deepEqual(JSON.parse(JSON.parse(body).body), { name: 'ok' })
  }

  {
    const { statusCode, body } = await gateway.inject({
      method: 'POST',
      url: '/either',
      headers: { 'content-type': multipartContentType },
      payload: multipartBody
    })
    assert.equal(statusCode, 200, body)
    assert.equal(JSON.parse(body).body, multipartBody)
  }

  assert.deepEqual(upstream.received, ['/either', '/either'])
})

test('the composed OpenAPI document keeps the pass-through request bodies', async t => {
  const upstream = await createUpstream(t)
  const gateway = await createGateway(t, upstream.origin)

  const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/documentation/json' })
  assert.equal(statusCode, 200)

  const { paths } = JSON.parse(body)
  assert.deepEqual(paths['/upload'].post.requestBody.content['multipart/form-data'].schema, fileBody)
  assert.deepEqual(Object.keys(paths['/binary'].put.requestBody.content), ['application/octet-stream'])
  assert.deepEqual(Object.keys(paths['/either'].post.requestBody.content), [
    'application/json',
    'multipart/form-data; charset=utf-8'
  ])
})

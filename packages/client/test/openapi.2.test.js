'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { unlink, mkdtemp, cp, rm } = require('node:fs/promises')
const { buildServer: buildService } = require('../../service')
const { buildOpenAPIClient } = require('..')
const Fastify = require('fastify')
require('./helper')

test('build basic client from file with (endpoint with duplicated parameters)', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'duped-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json')
  })

  const result = await client.postHello({
    body: {
      id: 'bodyId'
    },
    query: {
      id: 'queryId'
    },
    headers: {
      id: 'headersId'
    }
  })

  assert.deepEqual(result.headers.id, 'headersId')
  assert.deepEqual(result.query.id, 'queryId')
  assert.deepEqual(result.body.id, 'bodyId')
})

test('build basic client from file (enpoint with no parameters)', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'no-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json')
  })

  const bodyPayload = {
    body: {
      id: 'bodyId'
    },
    query: {
      id: 'queryId'
    },
    headers: {
      id: 'headersId'
    }
  }
  const postResult = await client.postHello(bodyPayload)

  assert.deepEqual(Object.keys(postResult.headers).length, 4) // some headers are returned...
  assert.equal(postResult.headers.id, undefined) // ...but not the 'id' passed in the request
  assert.deepEqual(postResult.query, {})
  assert.deepEqual(postResult.body, bodyPayload)

  const getResult = await client.getHello()
  assert.equal(getResult.message, 'GET /hello works')
})

test('build basic client from file (query array parameter)', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'array-query-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  {
    // // with fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: true,
      url: `${app.url}`,
      path: join(tmpDir, 'openapi.json')
    })

    const result = await client.getQuery({
      query: {
        ids: ['id1', 'id2'],
        stringArrayUnion: ['foo', 'bar', 'baz']
      }
    })
    assert.deepEqual(result.isArray, true)
    assert.deepEqual(result.ids, ['id1', 'id2'])
    assert.deepEqual(result.stringArrayUnion, ['foo', 'bar', 'baz'])
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'array-query-params', 'openapi.json')
    })

    const result = await client.getQuery({
      ids: ['id1', 'id2'],
      stringArrayUnion: ['foo', 'bar', 'baz']
    })
    assert.deepEqual(result.isArray, true)
    assert.deepEqual(result.ids, ['id1', 'id2'])
    assert.deepEqual(result.stringArrayUnion, ['foo', 'bar', 'baz'])
  }
})

test('build basic client from file (path parameter)', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'path-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  {
    // with fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: true,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'path-params', 'openapi.json')
    })

    const result = await client.getPath({
      path: { id: 'baz' },
      query: { name: 'bar' }
    })
    assert.equal(result.id, 'baz')
    assert.equal(result.name, 'bar')

    const { id, name } = await client.getPath({ path: { id: 'ok' }, query: { name: undefined } })
    assert.equal(id, 'ok')
    assert.equal(name, undefined)

    let error
    try {
      await client.getPath({ path: { id: undefined }, query: { name: 'bar' } })
    } catch (err) {
      error = err
    }
    assert.equal(error instanceof Error, true, 'when no path param is passed')
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'path-params', 'openapi.json')
    })

    const result = await client.getPath({
      id: 'baz',
      name: 'foo'
    })
    assert.equal(result.id, 'baz')
    assert.equal(result.name, 'foo')
  }
})

test('validate response', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'validate-response')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json'),
    validateResponse: true
  })

  // invalid response format
  const invalidResult = await client.getInvalid()
  assert.deepEqual(invalidResult, {
    statusCode: 500,
    message: 'Invalid response format'
  })

  // no matching route
  const noMatchingResult = await client.getNoMatching()
  assert.deepEqual(noMatchingResult, {
    statusCode: 500,
    message: 'No matching response schema found for status code 404'
  })

  // no matching content type
  const noMatchingContentTypeResult = await client.getNoContentType()
  assert.deepEqual(noMatchingContentTypeResult, {
    statusCode: 500,
    message: 'No matching content type schema found for application/json'
  })

  // another content type
  const htmlResult = await client.getNoContentType({
    returnType: 'html'
  })
  assert.deepEqual(htmlResult, '<h1>Hello World</h1>')

  // valid response
  const validResult = await client.getValid()
  assert.deepEqual(validResult.message, 'This is a valid response')

  // with refs
  const refsResult = await client.getWithRefs()
  assert.deepEqual(refsResult, {
    id: 123,
    title: 'Harry Potter'
  })

  // second call to make coverage happy about caching functions
  assert.deepEqual(await client.getWithRefs(), {
    id: 123,
    title: 'Harry Potter'
  })

  // Validate bodies when getting full response
  const fullResponseClient = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json'),
    validateResponse: true,
    fullResponse: true
  })

  // invalid response format
  const invalidFullResult = await fullResponseClient.getInvalid()
  assert.deepEqual(invalidFullResult.body, {
    statusCode: 500,
    message: 'Invalid response format'
  })

  // valid response
  const validFullResult = await fullResponseClient.getValid()
  assert.deepEqual(validFullResult.body.message, 'This is a valid response')
})

test('build client with common parameters', async (t) => {
  const app = Fastify()

  app.get('/path/with/:fieldId', async (req, res) => {
    return {
      pathParam: req.params.fieldId,
      queryParam: req.query.movieId
    }
  })

  const clientUrl = await app.listen({
    port: 0
  })
  t.after(() => {
    app.close()
  })
  const specPath = join(__dirname, 'fixtures', 'common-parameters-openapi.json')
  const client = await buildOpenAPIClient({
    url: clientUrl,
    path: specPath
  })

  const output = await client.getPathWithFieldId({
    fieldId: 'foo',
    movieId: '123'
  })

  assert.deepEqual({
    pathParam: 'foo',
    queryParam: '123'
  }, output)
})

test('build client with header injection options (getHeaders)', async (t) => {
  const app = Fastify()

  app.get('/path/with/:fieldId', async (req, res) => {
    return {
      pathParam: req.params.fieldId,
      queryParam: req.query.movieId
    }
  })

  const clientUrl = await app.listen({
    port: 0
  })
  t.after(() => {
    app.close()
  })
  const specPath = join(__dirname, 'fixtures', 'common-parameters-openapi.json')

  const fieldId = 'foo'
  const movieId = '123'

  const getHeaders = (options) => {
    const { url } = options
    assert.match(url.href, new RegExp(`path/with/${fieldId}\\?movieId=${movieId}`))
    return { href: url.href }
  }

  const client = await buildOpenAPIClient({
    url: clientUrl,
    path: specPath,
    getHeaders
  })

  const output = await client.getPathWithFieldId({
    fieldId,
    movieId
  })

  assert.deepEqual({
    pathParam: 'foo',
    queryParam: '123'
  }, output)
})

test('edge cases', async (t) => {
  const specPath = join(__dirname, 'fixtures', 'misc', 'openapi.json')
  const client = await buildOpenAPIClient({
    url: 'http://127.0.0.1:3000',
    path: specPath
  })
  assert.equal(typeof client.getTestWithWeirdCharacters, 'function')
})

test('do not set bodies for methods that should not have them', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'no-bodies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json')
  })

  const requestBody = { test: 'data' }

  // API sends back body content it receives
  const postResult = await client.postHello(requestBody)
  assert.deepEqual(postResult, requestBody)

  const putResult = await client.putHello(requestBody)
  assert.deepEqual(putResult, requestBody)

  const patchResult = await client.patchHello(requestBody)
  assert.deepEqual(patchResult, requestBody)

  const optionsResult = await client.optionsHello(requestBody)
  assert.deepEqual(optionsResult, requestBody)

  // https://www.rfc-editor.org/rfc/rfc9110
  // MUST NOT send content
  const traceResult = await client.traceHello(requestBody)
  assert.deepEqual(traceResult, '')

  // SHOULD NOT send content
  const getResult = await client.getHello(requestBody)
  assert.deepEqual(getResult, '')

  const deleteResult = await client.deleteHello(requestBody)
  assert.deepEqual(deleteResult, '')

  const headResult = await client.headHello(requestBody)
  assert.deepEqual(headResult, '')
})

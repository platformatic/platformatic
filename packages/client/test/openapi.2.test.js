'use strict'

const assert = require('node:assert/strict')
const errors = require('../errors')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { unlink, mkdtemp, cp, readFile } = require('node:fs/promises')
const { create } = require('@platformatic/service')
const { buildOpenAPIClient } = require('..')
const Fastify = require('fastify')
const { safeRemove } = require('@platformatic/utils')
const { openAsBlob } = require('node:fs')
const { FormData } = require('undici')
require('./helper')

test('build basic client from file with (endpoint with duplicated parameters)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'duped-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json'),
    fullRequest: false,
    fullResponse: false
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

test('build basic client from file (enpoint with no parameters)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'no-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json'),
    fullRequest: false,
    fullResponse: false
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

test('build basic client from file (query array parameter)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'array-query-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  {
    // // with fullRequest
    const client = await buildOpenAPIClient({
      fullResponse: false,
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
      fullResponse: false,
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

test('build basic client from file (path parameter)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'path-params')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  {
    // with fullRequest
    const client = await buildOpenAPIClient({
      fullResponse: false,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'path-params', 'openapi.json')
    })

    const params = {
      path: { id: 'baz' },
      query: { name: 'bar' }
    }
    const result = await client.getPath(params)
    assert.equal(result.id, 'baz')
    assert.equal(result.name, 'bar')
    assert.deepEqual(
      params,
      {
        path: { id: 'baz' },
        query: { name: 'bar' }
      },
      'calling the client should NOT override the sent params'
    )

    const { id, name } = await client.getPath({ path: { id: 'ok' }, query: { name: undefined } })
    assert.equal(id, 'ok')
    assert.equal(name, undefined)

    let error
    try {
      await client.getPath({ path: { id: undefined }, query: { name: 'bar' } })
    } catch (err) {
      error = err
    }
    assert.equal(error instanceof errors.MissingParamsRequiredError, true, 'when no path param is passed')
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      fullResponse: false,
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
  {
    // with timeout options
    const client = await buildOpenAPIClient({
      fullRequest: false,
      fullResponse: false,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'path-params', 'openapi.json'),
      bodyTimeout: 900000,
      headersTimeout: 900000
    })
    const result = await client.getPath({
      id: 'fracchia',
      name: 'fantozzi'
    })
    assert.equal(result.id, 'fracchia')
    assert.equal(result.name, 'fantozzi')
  }
})

test('validate response', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'validate-response')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
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
    fullRequest: false
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

test('build client with common parameters', async t => {
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
    path: specPath,
    fullRequest: false,
    fullResponse: false
  })

  const output = await client.getPathWithFieldId({
    fieldId: 'foo',
    movieId: '123'
  })

  assert.deepEqual(
    {
      pathParam: 'foo',
      queryParam: '123'
    },
    output
  )
})

test('build client with header injection options (getHeaders)', async t => {
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

  const getHeaders = options => {
    const { url } = options
    assert.match(url.href, new RegExp(`path/with/${fieldId}\\?movieId=${movieId}`))
    return { href: url.href }
  }

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: clientUrl,
    path: specPath,
    getHeaders
  })

  const output = await client.getPathWithFieldId({
    fieldId,
    movieId
  })

  assert.deepEqual(
    {
      pathParam: 'foo',
      queryParam: '123'
    },
    output
  )
})

test('edge cases', async t => {
  const specPath = join(__dirname, 'fixtures', 'misc', 'openapi.json')
  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: 'http://127.0.0.1:3000',
    path: specPath
  })
  assert.equal(typeof client.getTestWithWeirdCharacters, 'function')
})

test('should not throw when params are not passed', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'misc')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullResponse: false,
    url: `${app.url}`,
    path: join(tmpDir, 'openapi.json')
  })
  const result1 = await client.getTestWithWeirdCharacters({ id: 'foo' })
  assert.strictEqual(typeof result1, 'object', 'call with params')

  const result2 = await client.getTestWithWeirdCharacters({})
  assert.strictEqual(typeof result2, 'object', 'call without params')
})

test('do not set bodies for methods that should not have them', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'no-bodies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.service.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
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

test('multipart/form-data', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'sample-service')
  const app = await create(join(fixtureDirPath, 'platformatic.json'))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: `${app.url}/`,
    path: join(fixtureDirPath, 'openapi.json')
  })
  const formData = new FormData()
  formData.append('title', 'The Matrix')
  formData.append('foobar', 'foobar')
  const resp = await client.postFormdataMovies(formData)
  assert.ok(resp.id)
  assert.match(resp.contentType, /multipart\/form-data/)
  assert.deepEqual(resp.body, {
    title: 'The Matrix',
    foobar: 'foobar'
  })
})

test('multipart/form-data with files', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'sample-service')
  const app = await create(join(fixtureDirPath, 'platformatic.json'))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: `${app.url}/`,
    path: join(fixtureDirPath, 'openapi.json')
  })

  const formData = new FormData()
  const sampleFilePath = join(__dirname, 'helper.js')
  const fileAsBlob = await openAsBlob(sampleFilePath)
  formData.append('file', fileAsBlob, 'helper.js')
  const resp = await client.postFiles(formData)
  assert.equal(resp.file, (await readFile(sampleFilePath)).toString('utf-8'))
})

test('multipart/form-data without FormData', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'sample-service')
  const app = await create(join(fixtureDirPath, 'platformatic.json'))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: `${app.url}/`,
    path: join(fixtureDirPath, 'openapi.json')
  })
  try {
    await client.postFiles({ foo: 'bar' })
    assert.fail()
  } catch (err) {
    assert.ok(err instanceof errors.UnexpectedCallFailureError)
    assert.match(err.message, /should be called with a undici.FormData as payload/)
  }
})

test('multipart/form-data with files AND fields', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'sample-service')
  const app = await create(join(fixtureDirPath, 'platformatic.json'))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: `${app.url}/`,
    path: join(fixtureDirPath, 'openapi.json')
  })

  const formData = new FormData()
  const sampleFilePath = join(__dirname, 'helper.js')
  const fileAsBlob = await openAsBlob(sampleFilePath)
  formData.append('file', fileAsBlob, 'helper.js')
  formData.append('username', 'johndoe')
  const resp = await client.postFilesAndFields(formData)
  assert.equal(resp.file, (await readFile(sampleFilePath)).toString('utf-8'))
  assert.equal(resp.username, 'johndoe')
})

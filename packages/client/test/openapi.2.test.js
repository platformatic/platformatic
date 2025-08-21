import { safeRemove } from '@platformatic/foundation'
import { create } from '@platformatic/service'
import Fastify from 'fastify'
import { deepEqual, equal, fail, match, ok, strictEqual } from 'node:assert/strict'
import { openAsBlob } from 'node:fs'
import { cp, mkdtemp, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { FormData } from 'undici'
import { buildOpenAPIClient } from '../index.js'
import { MissingParamsRequiredError, UnexpectedCallFailureError } from '../lib/errors.js'

import './helper.js'

test('build basic client from file with (endpoint with duplicated parameters)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'duped-params')
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

  deepEqual(result.headers.id, 'headersId')
  deepEqual(result.query.id, 'queryId')
  deepEqual(result.body.id, 'bodyId')
})

test('build basic client from file (enpoint with no parameters)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'no-params')
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

  deepEqual(Object.keys(postResult.headers).length, 4) // some headers are returned...
  equal(postResult.headers.id, undefined) // ...but not the 'id' passed in the request
  deepEqual(postResult.query, {})
  deepEqual(postResult.body, bodyPayload)

  const getResult = await client.getHello()
  equal(getResult.message, 'GET /hello works')
})

test('build basic client from file (query array parameter)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'array-query-params')
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
    deepEqual(result.isArray, true)
    deepEqual(result.ids, ['id1', 'id2'])
    deepEqual(result.stringArrayUnion, ['foo', 'bar', 'baz'])
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      fullResponse: false,
      url: `${app.url}`,
      path: join(import.meta.dirname, 'fixtures', 'array-query-params', 'openapi.json')
    })

    const result = await client.getQuery({
      ids: ['id1', 'id2'],
      stringArrayUnion: ['foo', 'bar', 'baz']
    })
    deepEqual(result.isArray, true)
    deepEqual(result.ids, ['id1', 'id2'])
    deepEqual(result.stringArrayUnion, ['foo', 'bar', 'baz'])
  }
})

test('build basic client from file (path parameter)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'path-params')
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
      path: join(import.meta.dirname, 'fixtures', 'path-params', 'openapi.json')
    })

    const params = {
      path: { id: 'baz' },
      query: { name: 'bar' }
    }
    const result = await client.getPath(params)
    equal(result.id, 'baz')
    equal(result.name, 'bar')
    deepEqual(
      params,
      {
        path: { id: 'baz' },
        query: { name: 'bar' }
      },
      'calling the client should NOT override the sent params'
    )

    const { id, name } = await client.getPath({ path: { id: 'ok' }, query: { name: undefined } })
    equal(id, 'ok')
    equal(name, undefined)

    let error
    try {
      await client.getPath({ path: { id: undefined }, query: { name: 'bar' } })
    } catch (err) {
      error = err
    }
    equal(error instanceof MissingParamsRequiredError, true, 'when no path param is passed')
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      fullResponse: false,
      url: `${app.url}`,
      path: join(import.meta.dirname, 'fixtures', 'path-params', 'openapi.json')
    })

    const result = await client.getPath({
      id: 'baz',
      name: 'foo'
    })
    equal(result.id, 'baz')
    equal(result.name, 'foo')
  }
  {
    // with timeout options
    const client = await buildOpenAPIClient({
      fullRequest: false,
      fullResponse: false,
      url: `${app.url}`,
      path: join(import.meta.dirname, 'fixtures', 'path-params', 'openapi.json'),
      bodyTimeout: 900000,
      headersTimeout: 900000
    })
    const result = await client.getPath({
      id: 'fracchia',
      name: 'fantozzi'
    })
    equal(result.id, 'fracchia')
    equal(result.name, 'fantozzi')
  }
})

test('validate response', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'validate-response')
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
  deepEqual(invalidResult, {
    statusCode: 500,
    message: 'Invalid response format'
  })

  // no matching route
  const noMatchingResult = await client.getNoMatching()
  deepEqual(noMatchingResult, {
    statusCode: 500,
    message: 'No matching response schema found for status code 404'
  })

  // no matching content type
  const noMatchingContentTypeResult = await client.getNoContentType()
  deepEqual(noMatchingContentTypeResult, {
    statusCode: 500,
    message: 'No matching content type schema found for application/json'
  })

  // another content type
  const htmlResult = await client.getNoContentType({
    returnType: 'html'
  })
  deepEqual(htmlResult, '<h1>Hello World</h1>')

  // valid response
  const validResult = await client.getValid()
  deepEqual(validResult.message, 'This is a valid response')

  // with refs
  const refsResult = await client.getWithRefs()
  deepEqual(refsResult, {
    id: 123,
    title: 'Harry Potter'
  })

  // second call to make coverage happy about caching functions
  deepEqual(await client.getWithRefs(), {
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
  deepEqual(invalidFullResult.body, {
    statusCode: 500,
    message: 'Invalid response format'
  })

  // valid response
  const validFullResult = await fullResponseClient.getValid()
  deepEqual(validFullResult.body.message, 'This is a valid response')
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
  const specPath = join(import.meta.dirname, 'fixtures', 'common-parameters-openapi.json')
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

  deepEqual(
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
  const specPath = join(import.meta.dirname, 'fixtures', 'common-parameters-openapi.json')

  const fieldId = 'foo'
  const movieId = '123'

  const getHeaders = options => {
    const { url } = options
    match(url.href, new RegExp(`path/with/${fieldId}\\?movieId=${movieId}`))
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

  deepEqual(
    {
      pathParam: 'foo',
      queryParam: '123'
    },
    output
  )
})

test('edge cases', async t => {
  const specPath = join(import.meta.dirname, 'fixtures', 'misc', 'openapi.json')
  const client = await buildOpenAPIClient({
    fullRequest: false,
    fullResponse: false,
    url: 'http://127.0.0.1:3000',
    path: specPath
  })
  equal(typeof client.getTestWithWeirdCharacters, 'function')
})

test('should not throw when params are not passed', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'misc')
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
  strictEqual(typeof result1, 'object', 'call with params')

  const result2 = await client.getTestWithWeirdCharacters({})
  strictEqual(typeof result2, 'object', 'call without params')
})

test('do not set bodies for methods that should not have them', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'no-bodies')
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
  deepEqual(postResult, requestBody)

  const putResult = await client.putHello(requestBody)
  deepEqual(putResult, requestBody)

  const patchResult = await client.patchHello(requestBody)
  deepEqual(patchResult, requestBody)

  const optionsResult = await client.optionsHello(requestBody)
  deepEqual(optionsResult, requestBody)

  // https://www.rfc-editor.org/rfc/rfc9110
  // MUST NOT send content
  const traceResult = await client.traceHello(requestBody)
  deepEqual(traceResult, '')

  // SHOULD NOT send content
  const getResult = await client.getHello(requestBody)
  deepEqual(getResult, '')

  const deleteResult = await client.deleteHello(requestBody)
  deepEqual(deleteResult, '')

  const headResult = await client.headHello(requestBody)
  deepEqual(headResult, '')
})

test('multipart/form-data', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'sample-service')
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
  ok(resp.id)
  match(resp.contentType, /multipart\/form-data/)
  deepEqual(resp.body, {
    title: 'The Matrix',
    foobar: 'foobar'
  })
})

test('multipart/form-data with files', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'sample-service')
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
  const sampleFilePath = join(import.meta.dirname, 'helper.js')
  const fileAsBlob = await openAsBlob(sampleFilePath)
  formData.append('file', fileAsBlob, 'helper.js')
  const resp = await client.postFiles(formData)
  equal(resp.file, (await readFile(sampleFilePath)).toString('utf-8'))
})

test('multipart/form-data without FormData', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'sample-service')
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
    fail()
  } catch (err) {
    ok(err instanceof UnexpectedCallFailureError)
    match(err.message, /should be called with a undici.FormData as payload/)
  }
})

test('multipart/form-data with files AND fields', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'sample-service')
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
  const sampleFilePath = join(import.meta.dirname, 'helper.js')
  const fileAsBlob = await openAsBlob(sampleFilePath)
  formData.append('file', fileAsBlob, 'helper.js')
  formData.append('username', 'johndoe')
  const resp = await client.postFilesAndFields(formData)
  equal(resp.file, (await readFile(sampleFilePath)).toString('utf-8'))
  equal(resp.username, 'johndoe')
})

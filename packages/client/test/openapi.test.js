'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { unlink, mkdtemp, cp, rm } = require('node:fs/promises')
const { ResponseStatusCodeError } = require('undici').errors
const { buildServer } = require('../../db')
const { buildServer: buildService } = require('../../service')
const { buildOpenAPIClient } = require('..')
require('./helper')

test('rejects with no url', async (t) => {
  await assert.rejects(buildOpenAPIClient())
  await assert.rejects(buildOpenAPIClient({}))
  await assert.rejects(buildOpenAPIClient({
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  }))
})

test('build basic client from url', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  assert.deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  assert.deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  assert.deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  assert.deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })

  assert.deepEqual(updatedTitle, undefined)

  const movie3 = await client.getMovieById({
    id: 1
  })

  assert.deepEqual(movie3, {
    id: 1,
    title: 'The Matrix Revolutions'
  })

  await assert.rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  assert.deepEqual(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    assert.deepEqual(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    assert.deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }
})

test('build full response client from url', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true
  })

  const matchDate = /[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT/i
  const matchKeepAlive = /timeout=\d+/

  const movie = await client.createMovie({
    title: 'The Matrix'
  })
  assert.equal(movie.statusCode, 200)
  assert.equal(movie.headers.location, '/movies/1')
  assert.equal(movie.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(movie.headers['content-length'], '29')
  assert.equal(movie.headers.connection, 'keep-alive')
  assert.match(movie.headers.date, matchDate)
  assert.match(movie.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(movie.body, { id: 1, title: 'The Matrix' })

  const movies = await client.getMovies()
  assert.equal(movies.statusCode, 200)
  assert.equal(movies.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(movies.headers['content-length'], '31')
  assert.equal(movies.headers.connection, 'keep-alive')
  assert.match(movies.headers.date, matchDate)
  assert.match(movies.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(movies.body, [{ id: 1, title: 'The Matrix' }])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })
  assert.equal(updatedMovie.statusCode, 200)
  assert.equal(updatedMovie.headers.location, '/movies/1')
  assert.equal(updatedMovie.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(updatedMovie.headers['content-length'], '38')
  assert.equal(updatedMovie.headers.connection, 'keep-alive')
  assert.match(updatedMovie.headers.date, matchDate)
  assert.match(updatedMovie.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(updatedMovie.body, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({ id: 1 })
  assert.equal(movie2.statusCode, 200)
  assert.equal(movie2.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(movie2.headers['content-length'], '38')
  assert.equal(movie2.headers.connection, 'keep-alive')
  assert.match(movie2.headers.date, matchDate)
  assert.match(movie2.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(movie2.body, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })
  assert.equal(updatedTitle.statusCode, 204)
  assert.equal(updatedTitle.headers.connection, 'keep-alive')
  assert.match(updatedTitle.headers.date, matchDate)
  assert.match(updatedTitle.headers['keep-alive'], matchKeepAlive)
  assert.equal(updatedTitle.body, undefined)

  const movie3 = await client.getMovieById({ id: 1 })
  assert.equal(movie3.statusCode, 200)
  assert.equal(movie3.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(movie3.headers['content-length'], '41')
  assert.equal(movie3.headers.connection, 'keep-alive')
  assert.match(movie3.headers.date, matchDate)
  assert.match(movie3.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(movie3.body, {
    id: 1,
    title: 'The Matrix Revolutions'
  })

  await assert.rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  assert.equal(notFound.statusCode, 404)
  assert.equal(notFound.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(notFound.headers['content-length'], '82')
  assert.equal(notFound.headers.connection, 'keep-alive')
  assert.match(notFound.headers.date, matchDate)
  assert.match(notFound.headers['keep-alive'], matchKeepAlive)
  assert.deepEqual(notFound.body, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    assert.equal(movies.statusCode, 200)
    assert.equal(movies.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(movies.headers['content-length'], '2')
    assert.equal(movies.headers.connection, 'keep-alive')
    assert.match(movies.headers.date, matchDate)
    assert.match(movies.headers['keep-alive'], matchKeepAlive)
    assert.deepEqual(movies.body, [])
  }

  {
    const hello = await client.getHelloWorld()
    assert.equal(hello.statusCode, 200)
    assert.equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(hello.headers['content-length'], '17')
    assert.equal(hello.headers.connection, 'keep-alive')
    assert.match(hello.headers.date, matchDate)
    assert.match(hello.headers['keep-alive'], matchKeepAlive)
    assert.deepEqual(hello.body, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    assert.equal(hello.statusCode, 200)
    assert.equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(hello.headers['content-length'], '18')
    assert.equal(hello.headers.connection, 'keep-alive')
    assert.match(hello.headers.date, matchDate)
    assert.match(hello.headers['keep-alive'], matchKeepAlive)
    assert.deepEqual(hello.body, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    assert.equal(hello.statusCode, 200)
    assert.equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(hello.headers['content-length'], '18')
    assert.equal(hello.headers.connection, 'keep-alive')
    assert.match(hello.headers.date, matchDate)
    assert.match(hello.headers['keep-alive'], matchKeepAlive)
    assert.deepEqual(hello.body, { hello: 'Matteo' })
  }
})

test('throw on error level response', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(tmpDir, 'platformatic-prefix.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api/`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true
  })

  await assert.rejects(client.getMovieById({
    id: 100
  }), ResponseStatusCodeError)
})

test('build basic client from file', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(tmpDir, 'platformatic-prefix.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api/`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  assert.deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  assert.deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.putUpdateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  assert.deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  assert.deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await assert.rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  assert.deepEqual(notFound, {
    message: 'Route GET:/movies-api/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    assert.deepEqual(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    assert.deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }
})

test('build basic client from url with custom headers', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    headers: {
      'x-platformatic-admin-secret': 'changeme'
    }
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  assert.deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  assert.deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  assert.deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  assert.deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await assert.rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  assert.deepEqual(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    assert.deepEqual(movies, [])
  }

  {
    const hello = await client.getHello()
    assert.deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    assert.deepEqual(hello, { hello: 'Matteo' })
  }
})

test('302', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies-no-200')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/`,
    path: join(tmpDir, 'openapi.json')
  })
  {
    const resp = await client.redirectMe()
    assert.deepEqual(resp.statusCode, 302)
    assert.deepEqual(resp.headers.location, 'https://google.com')
  }

  {
    const resp = await client.nonStandard()
    assert.deepEqual(resp.statusCode, 470)
  }
})

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
})

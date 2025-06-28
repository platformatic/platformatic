'use strict'

const { getGlobalDispatcher, setGlobalDispatcher, MockAgent } = require('undici')
const errors = require('../errors')
const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test, mock } = require('node:test')
const { join } = require('node:path')
const { unlink, mkdtemp, cp } = require('node:fs/promises')
const { create } = require('../../db')
const { buildOpenAPIClient } = require('..')
const { safeRemove } = require('@platformatic/utils')
require('./helper')

test('rejects with no url', async t => {
  await assert.rejects(buildOpenAPIClient())
  await assert.rejects(buildOpenAPIClient({}))
  await assert.rejects(
    buildOpenAPIClient({
      path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
    })
  )
})

test('build basic client from url', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`
  })

  assert.deepEqual(client[Symbol.for('plt.operationIdMap')], {
    getMovies: { path: '/movies/', method: 'get' },
    createMovie: { path: '/movies/', method: 'post' },
    updateMovies: { path: '/movies/', method: 'put' },
    getMovieById: { path: '/movies/{id}', method: 'get' },
    updateMovie: { path: '/movies/{id}', method: 'put' },
    deleteMovies: { path: '/movies/{id}', method: 'delete' },
    updateMovieTitle: { path: '/movies/{id}/{title}', method: 'put' },
    getHelloWorld: { path: '/hello-world', method: 'get' },
    getHelloName: { path: '/hello/{name}', method: 'get' },
    getHelloHeaderName: { path: '/hello/header/name', method: 'get' },
    postWeirdName: { path: '/weird/{name}', method: 'post' }
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

  let error
  try {
    await client.getMovieById()
  } catch (err) {
    error = err
  }
  assert.ok(error instanceof errors.MissingParamsRequiredError, 'when no param is passed')

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

test('build full response client from url', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
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

test('properly call query parser', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const mockQueryParser = mock.fn()
  const clientWithoutQueryParser = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true
  })

  const resultWithoutQueryParser = await clientWithoutQueryParser.getMovies()
  assert.equal(resultWithoutQueryParser.statusCode, 200)
  assert.strictEqual(mockQueryParser.mock.callCount(), 0)

  const clientWithQueryParser = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true,
    queryParser: mockQueryParser
  })

  const { statusCode } = await clientWithQueryParser.getMovies()
  assert.equal(statusCode, 200)
  assert.strictEqual(mockQueryParser.mock.callCount(), 1)
})

test('properly call undici dispatcher', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const clientWithoutDispatcher = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true
  })

  const resultWithoutDispatcher = await clientWithoutDispatcher.getMovies()
  assert.equal(resultWithoutDispatcher.statusCode, 200, 'no dispatcher passed')

  const dispatcher = getGlobalDispatcher()
  const clientWithDispatcher = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true,
    dispatcher
  })

  const { statusCode } = await clientWithDispatcher.getMovies()
  assert.equal(statusCode, 200, 'valid dispatcher is passed')

  let error
  try {
    const client = await buildOpenAPIClient({
      url: `${app.url}/documentation/json`,
      fullResponse: true,
      dispatcher: 'CARLO MARTELLO!'
    })
    await client.getMovies()
  } catch (err) {
    error = err
  }

  assert.notEqual(error, undefined, 'should throw when passing a wrong dispatcher')
  assert.ok(error instanceof errors.UnexpectedCallFailureError)
  assert.ok(error.toString().includes('this.dispatch is not a function'))
})

test('throw on error level response', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic-prefix.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api/`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true
  })

  await assert.rejects(
    client.getMovieById({
      id: 100
    }),
    err => {
      assert.ok(err instanceof errors.UnexpectedCallFailureError)

      // Persists response properties from Undici error
      assert.equal(err.status, 404)
      assert.equal(err.statusCode, 404)
      assert.equal(typeof err.headers, 'object')
      assert.equal(err.headers['content-type'], 'application/json; charset=utf-8')
      assert.deepEqual(err.body, {
        error: 'Not Found',
        message: 'Route GET:/movies-api/movies/100 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('throw on error level response (modified global dispatcher)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic-prefix.db.json'))
  const agent = getGlobalDispatcher()

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
    setGlobalDispatcher(agent)
  })
  await app.start()

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  // Provide the base url to the request
  const mockPool = mockAgent.get(app.url)

  // intercept the request
  mockPool
    .intercept({
      path: '/movies-api/movies/100',
      method: 'GET'
    })
    .reply(
      404,
      {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/100 not found',
        statusCode: 404
      },
      {
        headers: { 'content-type': 'application/json' }
      }
    )

  // should use getGlobalDispatcher() internally and hit mock
  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true
  })

  await assert.rejects(
    client.getMovieById({
      id: 100
    }),
    err => {
      assert.deepEqual(err.body, {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/100 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('throw on error level response (supplied dispatcher)', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic-prefix.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
  })
  await app.start()

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()

  // Provide the base url to the request
  const mockPool = mockAgent.get(app.url)

  // intercept the request
  mockPool
    .intercept({
      path: '/movies-api/movies/200',
      method: 'GET'
    })
    .reply(
      404,
      {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/200 not found',
        statusCode: 404
      },
      {
        headers: { 'content-type': 'application/json' }
      }
    )

  // should use getGlobalDispatcher() internally and hit mock
  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true,
    dispatcher: mockAgent
  })

  await assert.rejects(
    client.getMovieById({
      id: 200
    }),
    err => {
      assert.deepEqual(err.body, {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/200 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('build basic client from file', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic-prefix.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
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

test('build basic client from url with custom headers', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
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

test('302', async t => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies-no-200')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await create(join(tmpDir, 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
    await safeRemove(tmpDir)
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

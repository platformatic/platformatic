import { create } from '@platformatic/db'
import { safeRemove } from '@platformatic/foundation'
import { deepEqual, equal, match, notEqual, ok, rejects, strictEqual } from 'node:assert/strict'
import { cp, mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock, test } from 'node:test'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'
import { buildOpenAPIClient } from '../index.js'
import { MissingParamsRequiredError, UnexpectedCallFailureError } from '../lib/errors.js'
import './helper.js'

test('rejects with no url', async t => {
  await rejects(buildOpenAPIClient())
  await rejects(buildOpenAPIClient({}))
  await rejects(
    buildOpenAPIClient({
      path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json')
    })
  )
})

test('build basic client from url', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    fullRequest: false,
    fullResponse: false
  })

  deepEqual(client[Symbol.for('plt.operationIdMap')], {
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

  deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })

  deepEqual(updatedTitle, undefined)

  const movie3 = await client.getMovieById({
    id: 1
  })

  deepEqual(movie3, {
    id: 1,
    title: 'The Matrix Revolutions'
  })

  let error
  try {
    await client.getMovieById()
  } catch (err) {
    error = err
  }
  ok(error instanceof MissingParamsRequiredError, 'when no param is passed')

  const notFound = await client.getMovieById({ id: 100 })
  deepEqual(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    deepEqual(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }
})

test('build full response client from url', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    fullResponse: true,
    fullRequest: false
  })

  const matchDate = /[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT/i
  const matchKeepAlive = /timeout=\d+/

  const movie = await client.createMovie({
    title: 'The Matrix'
  })
  equal(movie.statusCode, 200)
  equal(movie.headers.location, '/movies/1')
  equal(movie.headers['content-type'], 'application/json; charset=utf-8')
  equal(movie.headers['content-length'], '29')
  equal(movie.headers.connection, 'keep-alive')
  match(movie.headers.date, matchDate)
  match(movie.headers['keep-alive'], matchKeepAlive)
  deepEqual(movie.body, { id: 1, title: 'The Matrix' })

  const movies = await client.getMovies()
  equal(movies.statusCode, 200)
  equal(movies.headers['content-type'], 'application/json; charset=utf-8')
  equal(movies.headers['content-length'], '31')
  equal(movies.headers.connection, 'keep-alive')
  match(movies.headers.date, matchDate)
  match(movies.headers['keep-alive'], matchKeepAlive)
  deepEqual(movies.body, [{ id: 1, title: 'The Matrix' }])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })
  equal(updatedMovie.statusCode, 200)
  equal(updatedMovie.headers.location, '/movies/1')
  equal(updatedMovie.headers['content-type'], 'application/json; charset=utf-8')
  equal(updatedMovie.headers['content-length'], '38')
  equal(updatedMovie.headers.connection, 'keep-alive')
  match(updatedMovie.headers.date, matchDate)
  match(updatedMovie.headers['keep-alive'], matchKeepAlive)
  deepEqual(updatedMovie.body, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({ id: 1 })
  equal(movie2.statusCode, 200)
  equal(movie2.headers['content-type'], 'application/json; charset=utf-8')
  equal(movie2.headers['content-length'], '38')
  equal(movie2.headers.connection, 'keep-alive')
  match(movie2.headers.date, matchDate)
  match(movie2.headers['keep-alive'], matchKeepAlive)
  deepEqual(movie2.body, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })
  equal(updatedTitle.statusCode, 204)
  equal(updatedTitle.headers.connection, 'keep-alive')
  match(updatedTitle.headers.date, matchDate)
  match(updatedTitle.headers['keep-alive'], matchKeepAlive)
  equal(updatedTitle.body, undefined)

  const movie3 = await client.getMovieById({ id: 1 })
  equal(movie3.statusCode, 200)
  equal(movie3.headers['content-type'], 'application/json; charset=utf-8')
  equal(movie3.headers['content-length'], '41')
  equal(movie3.headers.connection, 'keep-alive')
  match(movie3.headers.date, matchDate)
  match(movie3.headers['keep-alive'], matchKeepAlive)
  deepEqual(movie3.body, {
    id: 1,
    title: 'The Matrix Revolutions'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  equal(notFound.statusCode, 404)
  equal(notFound.headers['content-type'], 'application/json; charset=utf-8')
  equal(notFound.headers['content-length'], '82')
  equal(notFound.headers.connection, 'keep-alive')
  match(notFound.headers.date, matchDate)
  match(notFound.headers['keep-alive'], matchKeepAlive)
  deepEqual(notFound.body, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    equal(movies.statusCode, 200)
    equal(movies.headers['content-type'], 'application/json; charset=utf-8')
    equal(movies.headers['content-length'], '2')
    equal(movies.headers.connection, 'keep-alive')
    match(movies.headers.date, matchDate)
    match(movies.headers['keep-alive'], matchKeepAlive)
    deepEqual(movies.body, [])
  }

  {
    const hello = await client.getHelloWorld()
    equal(hello.statusCode, 200)
    equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    equal(hello.headers['content-length'], '17')
    equal(hello.headers.connection, 'keep-alive')
    match(hello.headers.date, matchDate)
    match(hello.headers['keep-alive'], matchKeepAlive)
    deepEqual(hello.body, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    equal(hello.statusCode, 200)
    equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    equal(hello.headers['content-length'], '18')
    equal(hello.headers.connection, 'keep-alive')
    match(hello.headers.date, matchDate)
    match(hello.headers['keep-alive'], matchKeepAlive)
    deepEqual(hello.body, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    equal(hello.statusCode, 200)
    equal(hello.headers['content-type'], 'application/json; charset=utf-8')
    equal(hello.headers['content-length'], '18')
    equal(hello.headers.connection, 'keep-alive')
    match(hello.headers.date, matchDate)
    match(hello.headers['keep-alive'], matchKeepAlive)
    deepEqual(hello.body, { hello: 'Matteo' })
  }
})

test('properly call query parser', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    fullResponse: true,
    fullRequest: false
  })

  const resultWithoutQueryParser = await clientWithoutQueryParser.getMovies()
  equal(resultWithoutQueryParser.statusCode, 200)
  strictEqual(mockQueryParser.mock.callCount(), 0)

  const clientWithQueryParser = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true,
    fullRequest: false,
    queryParser: mockQueryParser
  })

  const { statusCode } = await clientWithQueryParser.getMovies()
  equal(statusCode, 200)
  strictEqual(mockQueryParser.mock.callCount(), 1)
})

test('properly call undici dispatcher', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    fullResponse: true,
    fullRequest: false
  })

  const resultWithoutDispatcher = await clientWithoutDispatcher.getMovies()
  equal(resultWithoutDispatcher.statusCode, 200, 'no dispatcher passed')

  const dispatcher = getGlobalDispatcher()
  const clientWithDispatcher = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`,
    fullResponse: true,
    fullRequest: false,
    dispatcher
  })

  const { statusCode } = await clientWithDispatcher.getMovies()
  equal(statusCode, 200, 'valid dispatcher is passed')

  let error
  try {
    const client = await buildOpenAPIClient({
      url: `${app.url}/documentation/json`,
      fullResponse: true,
      fullRequest: false,
      dispatcher: 'CARLO MARTELLO!'
    })
    await client.getMovies()
  } catch (err) {
    error = err
  }

  notEqual(error, undefined, 'should throw when passing a wrong dispatcher')
  ok(error instanceof UnexpectedCallFailureError)
  ok(error.toString().includes('this.dispatch is not a function'))
})

test('throw on error level response', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true,
    fullRequest: false,
    fullResponse: false
  })

  await rejects(
    client.getMovieById({
      id: 100
    }),
    err => {
      ok(err instanceof UnexpectedCallFailureError)

      // Persists response properties from Undici error
      equal(err.status, 404)
      equal(err.statusCode, 404)
      equal(typeof err.headers, 'object')
      equal(err.headers['content-type'], 'application/json; charset=utf-8')
      deepEqual(err.body, {
        error: 'Not Found',
        message: 'Route GET:/movies-api/movies/100 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('only add the throwOnError interceptor once', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    t.mock.reset()
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
    .reply(204, null)
    .persist()

  const spy = t.mock.method(mockAgent, 'compose')
  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api`,
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true,
    fullRequest: false
  })

  // Previosly the client was composing the dispatcher with the throw on error
  // interceptor on every request, see PR #4194
  for (let i = 0; i < 10; i++) {
    await client.getMovieById({ id: 100 })
  }

  // Should only compose the dispatcher once
  equal(spy.mock.callCount(), 1)
})

test('throw on error level response (modified global dispatcher)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true,
    fullRequest: false,
    fullResponse: false
  })

  await rejects(
    client.getMovieById({
      id: 100
    }),
    err => {
      deepEqual(err.body, {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/100 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('throw on error level response (supplied dispatcher)', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true,
    dispatcher: mockAgent,
    fullRequest: false,
    fullResponse: false
  })

  await rejects(
    client.getMovieById({
      id: 200
    }),
    err => {
      deepEqual(err.body, {
        error: 'Mocked Error',
        message: 'Route GET:/movies-api/movies/200 not found',
        statusCode: 404
      })
      return true
    }
  )
})

test('build basic client from file', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
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
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json'),
    fullRequest: false,
    fullResponse: false
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.putUpdateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  deepEqual(notFound, {
    message: 'Route GET:/movies-api/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    deepEqual(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }
})

test('build basic client from url with custom headers', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'auth')
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
    },
    fullRequest: false,
    fullResponse: false
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  deepEqual(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  deepEqual(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  deepEqual(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  deepEqual(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  deepEqual(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    deepEqual(movies, [])
  }

  {
    const hello = await client.getHello()
    deepEqual(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    deepEqual(hello, { hello: 'Matteo' })
  }
})

test('302', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies-no-200')
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
    path: join(tmpDir, 'openapi.json'),
    fullRequest: false,
    fullResponse: false
  })
  {
    const resp = await client.redirectMe()
    deepEqual(resp.statusCode, 302)
    deepEqual(resp.headers.location, 'https://google.com')
  }

  {
    const resp = await client.nonStandard()
    deepEqual(resp.statusCode, 470)
  }
})

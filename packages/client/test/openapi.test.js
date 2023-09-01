'use strict'

require('./helper')
const { test } = require('tap')
const { ResponseStatusCodeError } = require('undici').errors
const { buildServer } = require('../../db')
const { buildServer: buildService } = require('../../service')
const { join } = require('path')
const { buildOpenAPIClient } = require('..')
const fs = require('fs/promises')
const Fastify = require('fastify')
const client = require('..')

const fakeTelemetry = {
  startSpanClient: () => {},
  endSpanClient: () => null,
  setErrorInSpanClient: () => null
}

test('rejects with no url', async ({ rejects }) => {
  await rejects(buildOpenAPIClient())
  await rejects(buildOpenAPIClient({}))
  await rejects(buildOpenAPIClient({
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  }, fakeTelemetry))
})

test('build basic client from url', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/documentation/json`
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  same(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  same(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  same(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })

  same(updatedTitle, undefined)

  const movie3 = await client.getMovieById({
    id: 1
  })

  same(movie3, {
    id: 1,
    title: 'The Matrix Revolutions'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  same(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    same(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    same(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }
})

test('build full response client from url', async ({ teardown, same, match, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
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

  match(movie, {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '29',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: {
      id: 1,
      title: 'The Matrix'
    }
  })

  const movies = await client.getMovies()

  match(movies, {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '31',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: [
      {
        id: 1,
        title: 'The Matrix'
      }
    ]
  })

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  match(updatedMovie, {
    statusCode: 200,
    headers: {
      location: '/movies/1',
      'content-type': 'application/json; charset=utf-8',
      'content-length': '38',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: {
      id: 1,
      title: 'The Matrix Reloaded'
    }
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  match(movie2, {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '38',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: {
      id: 1,
      title: 'The Matrix Reloaded'
    }
  })

  const updatedTitle = await client.updateMovieTitle({ id: 1, title: 'The Matrix Revolutions' })

  match(updatedTitle, {
    statusCode: 204,
    headers: {
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: undefined
  })

  const movie3 = await client.getMovieById({
    id: 1
  })

  match(movie3, {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '41',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: {
      id: 1,
      title: 'The Matrix Revolutions'
    }
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  match(notFound, {
    statusCode: 404,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '82',
      date: matchDate,
      connection: 'keep-alive',
      'keep-alive': matchKeepAlive
    },
    body: {
      message: 'Route GET:/movies/100 not found',
      error: 'Not Found',
      statusCode: 404
    }
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    match(movies, {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '2',
        date: matchDate,
        connection: 'keep-alive',
        'keep-alive': matchKeepAlive
      },
      body: []
    })
  }

  {
    const hello = await client.getHelloWorld()
    match(hello, {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '17',
        date: matchDate,
        connection: 'keep-alive',
        'keep-alive': matchKeepAlive
      },
      body: {
        hello: 'world'
      }
    })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    match(hello, {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '18',
        date: matchDate,
        connection: 'keep-alive',
        'keep-alive': matchKeepAlive
      },
      body: {
        hello: 'Matteo'
      }
    })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    match(hello, {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '18',
        date: matchDate,
        connection: 'keep-alive',
        'keep-alive': matchKeepAlive
      },
      body: {
        hello: 'Matteo'
      }
    })
  }
})

test('throw on error level response', async ({ teardown, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic-prefix.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api/`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json'),
    throwOnError: true
  })

  rejects(client.getMovieById({
    id: 100
  }), ResponseStatusCodeError)
})

test('build basic client from file', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic-prefix.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/movies-api/`,
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  })

  const movie = await client.createMovie({
    title: 'The Matrix'
  })

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  same(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.putUpdateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  same(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  same(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  same(notFound, {
    message: 'Route GET:/movies-api/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    same(movies, [])
  }

  {
    const hello = await client.getHelloWorld()
    same(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }
})

test('build basic client from url with custom headers', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'auth', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'auth', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
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

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.getMovies()

  same(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])

  const updatedMovie = await client.updateMovie({
    id: 1,
    title: 'The Matrix Reloaded'
  })

  same(updatedMovie, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  const movie2 = await client.getMovieById({
    id: 1
  })

  same(movie2, {
    id: 1,
    title: 'The Matrix Reloaded'
  })

  await rejects(client.getMovieById())

  const notFound = await client.getMovieById({ id: 100 })
  same(notFound, {
    message: 'Route GET:/movies/100 not found',
    error: 'Not Found',
    statusCode: 404
  })

  {
    const movies = await client.getMovies({ 'where.title.eq': 'Star Wars' })
    same(movies, [])
  }

  {
    const hello = await client.getHello()
    same(hello, { hello: 'world' })
  }

  {
    const hello = await client.getHelloName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }

  {
    const hello = await client.getHelloHeaderName({ name: 'Matteo' })
    same(hello, { hello: 'Matteo' })
  }
})

test('302', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies-no-200', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'movies-no-200', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}/`,
    path: join(__dirname, 'fixtures', 'movies-no-200', 'openapi.json')
  })
  {
    const resp = await client.redirectMe()
    same(resp.statusCode, 302)
    same(resp.headers.location, 'https://google.com')
  }

  {
    const resp = await client.nonStandard()
    same(resp.statusCode, 470)
  }
})

test('build basic client from file with (endpoint with duplicated parameters)', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'duped-params', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(__dirname, 'fixtures', 'duped-params', 'platformatic.service.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(__dirname, 'fixtures', 'duped-params', 'openapi.json')
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

  same(result.headers.id, 'headersId')
  same(result.query.id, 'queryId')
  same(result.body.id, 'bodyId')
})

test('build basic client from file (enpoint with no parameters)', async ({ teardown, same, notOk }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'no-params', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(__dirname, 'fixtures', 'no-params', 'platformatic.service.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const client = await buildOpenAPIClient({
    url: `${app.url}`,
    path: join(__dirname, 'fixtures', 'no-params', 'openapi.json')
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

  same(Object.keys(postResult.headers).length, 4) // some headers are returned...
  notOk(postResult.headers.id) // ...but not the 'id' passed in the request
  same(postResult.query, {})
  same(postResult.body, bodyPayload)

  const getResult = await client.getHello()
  same(getResult.message, 'GET /hello works')
})

test('build basic client from file (query array parameter)', async ({ teardown, same, match }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'array-query-params', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildService(join(__dirname, 'fixtures', 'array-query-params', 'platformatic.service.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    // // with fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: true,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'array-query-params', 'openapi.json')
    })

    const result = await client.getQuery({
      query: {
        ids: ['id1', 'id2']
      }
    })
    same(result.isArray, true)
    match(result.ids, ['id1', 'id2'])
  }
  {
    // without fullRequest
    const client = await buildOpenAPIClient({
      fullRequest: false,
      url: `${app.url}`,
      path: join(__dirname, 'fixtures', 'array-query-params', 'openapi.json')
    }, fakeTelemetry)

    const result = await client.getQuery({
      ids: ['id1', 'id2']
    })
    same(result.isArray, true)
    match(result.ids, ['id1', 'id2'])
  }
})

test('build basic client from file (remove headers from getHeaders)', async ({ teardown, same, match }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'remove-getheaders', 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildService(join(__dirname, 'fixtures', 'remove-getheaders', 'platformatic.service.json'))

  teardown(async () => {
    await targetApp.close()
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}`,
    path: join(__dirname, 'fixtures', 'remove-getheaders', 'openapi.json'),
    async getHeaders (req) {
      return {
        toRemove: 'this-should-be-in-header-and-not-in-query'
      }
    }
  })

  app.post('/', async (req) => {
    const output = await req.client.postRemoveGetHeaders({
      query: {
        toRemove: 'this-should-not-appear',
        id: '123'
      },
      body: {
        toRemove: 'do-not-show',
        foobar: 'fizzbuzz'
      }
    })

    return output
  })

  const res = await app.inject({
    method: 'POST',
    url: '/'
  })

  same(res.statusCode, 200)
  same(res.json(), {
    headerValue: 'this-should-be-in-header-and-not-in-query',
    query: {
      id: '123'
    },
    body: {
      foobar: 'fizzbuzz'
    }
  })
})

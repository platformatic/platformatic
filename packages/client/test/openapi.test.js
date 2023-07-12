'use strict'

require('./helper')
const { test } = require('tap')
const { ResponseStatusCodeError } = require('undici').errors
const { buildServer } = require('../../db')
const { join } = require('path')
const { buildOpenAPIClient } = require('..')
const fs = require('fs/promises')

test('rejects with no url', async ({ rejects }) => {
  await rejects(buildOpenAPIClient())
  await rejects(buildOpenAPIClient({}))
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

'use strict'

require('./helper')
const { test } = require('tap')
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
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const client = await buildOpenAPIClient({
    url: `${server.url}/documentation/json`
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
})

test('build basic client from file', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const client = await buildOpenAPIClient({
    url: server.url,
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
})

test('build basic client from url with custom headers', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'auth', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'auth', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const client = await buildOpenAPIClient({
    url: `${server.url}/documentation/json`,
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
})

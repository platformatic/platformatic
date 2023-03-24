'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('../../db')
const { join } = require('path')
const client = require('..')
const fs = require('fs/promises')
const Fastify = require('fastify')

test('wrong type', async ({ teardown, same, rejects }) => {
  const app = Fastify()

  await rejects(app.register(client, {
    type: 'foo',
    url: 'http://localhost:3042/documentation/json',
    name: 'client'
  }), new Error('opts.type must be either "openapi" or "graphql"'))
})

test('default decorator', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${server.url}/documentation/json`
  })

  const movie = await app.client.createMovie({
    title: 'The Matrix'
  })

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.client.getMovies()

  same(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI and auth', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'auth', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'auth', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${server.url}/documentation/json`,
    async getHeaders (req) {
      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async (req) => {
    const movie = await req.client.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: {
      'x-platformatic-admin-secret': 'changeme'
    }
  })

  same(res.statusCode, 200)
  same(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('app decorator with OpenAPI', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${server.url}/documentation/json`,
    name: 'client'
  })

  const movie = await app.client.createMovie({
    title: 'The Matrix'
  })

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.client.getMovies()

  same(movies, [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'auth', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'auth', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${server.url}/documentation/json`,
    name: 'client',
    async getHeaders (req) {
      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async (req) => {
    const movie = await req.client.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: {
      'x-platformatic-admin-secret': 'changeme'
    }
  })

  same(res.statusCode, 200)
  same(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('req decorator with OpenAPI', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${server.url}/documentation/json`,
    name: 'movies'
  })

  app.post('/', async (req) => {
    const movie = await req.movies.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  const res = await app.inject({
    method: 'POST',
    url: '/'
  })

  same(res.statusCode, 200)
  same(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('req decorator with GraphQL and auth', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'auth', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'auth', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const app = Fastify()

  await app.register(client, {
    type: 'graphql',
    url: `${server.url}/graphql`,
    async getHeaders (req) {
      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async (req) => {
    const movie = await req.client.graphql({
      query: `
        mutation createMovie($title: String!) {
          saveMovie(input: {title: $title}) {
            id
            title
          }
        }
      `,
      variables: {
        title: 'The Matrix'
      }
    })
    return movie
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: {
      'x-platformatic-admin-secret': 'changeme'
    }
  })

  same(res.statusCode, 200)
  same(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

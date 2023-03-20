'user strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('../../db')
const { join } = require('path')
const { buildGraphQLClient } = require('..')
const fs = require('fs/promises')
const Fastify = require('fastify')

test('rejects with no url', async ({ rejects }) => {
  await rejects(buildGraphQLClient())
  await rejects(buildGraphQLClient({}))
})

test('status code !== 200', async ({ teardown, same, rejects }) => {
  const fastify = Fastify()
  fastify.post('/graphql', async (request, reply) => {
    reply.code(500)
    return {
      data: {
        hello: 'world'
      }
    }
  })
  await fastify.listen({ port: 0 })

  teardown(fastify.close.bind(fastify))

  const client = await buildGraphQLClient({
    url: `http://localhost:${fastify.server.address().port}/graphql`
  })

  await rejects(client.graphql({
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
  }), new Error('request to client failed'))
})

test('errors', async ({ teardown, same, rejects }) => {
  const fastify = Fastify()
  fastify.post('/graphql', async (request, reply) => {
    return {
      errors: [{
        message: 'hello world'
      }]
    }
  })
  await fastify.listen({ port: 0 })

  teardown(fastify.close.bind(fastify))

  const client = await buildGraphQLClient({
    url: `http://localhost:${fastify.server.address().port}/graphql`
  })

  await rejects(client.graphql({
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
  }), new Error('hello world'))
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

  const client = await buildGraphQLClient({
    url: `${server.url}/graphql`
  })

  const movie = await client.graphql({
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

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.graphql({
    query: `
    query getMovies {
      movies {
        id
        title
      }
      getMovieById(id: 1) {
        id
        title
      }
    }
    `
  })

  same(movies, {
    movies: [{
      id: 1,
      title: 'The Matrix'
    }],
    getMovieById: {
      id: 1,
      title: 'The Matrix'
    }
  })
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

  const client = await buildGraphQLClient({
    url: `${server.url}/graphql`,
    headers: {
      'x-platformatic-admin-secret': 'changeme'
    }
  })

  const movie = await client.graphql({
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

  same(movie, {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await client.graphql({
    query: `
    query getMovies {
      movies {
        id
        title
      }
      getMovieById(id: 1) {
        id
        title
      }
    }
    `
  })

  same(movies, {
    movies: [{
      id: 1,
      title: 'The Matrix'
    }],
    getMovieById: {
      id: 1,
      title: 'The Matrix'
    }
  })
})

test('bad query', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const client = await buildGraphQLClient({
    url: `${server.url}/graphql`
  })

  await rejects(client.graphql({
    query: 'foo'
  }))
})

test('error within resolver', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const server = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))
  teardown(server.stop)
  await server.listen()

  const client = await buildGraphQLClient({
    url: `${server.url}/graphql`
  })

  await rejects(client.graphql({
    query: '{ hello }'
  }))
})

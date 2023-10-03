'user strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { mkdtemp, cp, unlink, rm } = require('node:fs/promises')
const Fastify = require('fastify')
const { buildServer } = require('../../db')
const { buildGraphQLClient } = require('..')
require('./helper')

test('rejects with no url', async (t) => {
  await assert.rejects(buildGraphQLClient())
  await assert.rejects(buildGraphQLClient({}))
})

test('status code !== 200', async (t) => {
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

  t.after(async () => {
    await fastify.close()
  })

  const client = await buildGraphQLClient({
    url: `http://localhost:${fastify.server.address().port}/graphql`
  })

  await assert.rejects(client.graphql({
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

test('errors', async (t) => {
  const fastify = Fastify()
  fastify.post('/graphql', async (request, reply) => {
    return {
      errors: [{
        message: 'hello world'
      }]
    }
  })
  await fastify.listen({ port: 0 })

  t.after(async () => {
    await fastify.close()
  })

  const client = await buildGraphQLClient({
    url: `http://localhost:${fastify.server.address().port}/graphql`
  })

  await assert.rejects(client.graphql({
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

  const client = await buildGraphQLClient({
    url: `${app.url}/graphql`
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

  assert.deepEqual(movie, {
    id: '1',
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

  assert.deepEqual(movies, {
    movies: [{
      id: '1',
      title: 'The Matrix'
    }],
    getMovieById: {
      id: '1',
      title: 'The Matrix'
    }
  })
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

  const client = await buildGraphQLClient({
    url: `${app.url}/graphql`,
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

  assert.deepEqual(movie, {
    id: '1',
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

  assert.deepEqual(movies, {
    movies: [{
      id: '1',
      title: 'The Matrix'
    }],
    getMovieById: {
      id: '1',
      title: 'The Matrix'
    }
  })
})

test('bad query', async (t) => {
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

  const client = await buildGraphQLClient({
    url: `${app.url}/graphql`
  })

  await assert.rejects(client.graphql({
    query: 'foo'
  }))
})

test('error within resolver', async (t) => {
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

  const client = await buildGraphQLClient({
    url: `${app.url}/graphql`
  })

  await assert.rejects(client.graphql({
    query: '{ hello }'
  }))
})

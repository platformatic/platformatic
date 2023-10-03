'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { mkdtemp, cp, unlink, rm } = require('node:fs/promises')
const Fastify = require('fastify')
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici')
const { buildServer } = require('../../db')
const client = require('..')
require('./helper')

test('wrong type', async (t) => {
  const app = Fastify()

  await assert.rejects(async () => {
    return await app.register(client, {
      type: 'foo',
      url: 'http://localhost:3042/documentation/json',
      name: 'client'
    })
  }, new Error('opts.type must be either "openapi" or "graphql"'))
})

test('default decorator', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`
  })

  app.post('/movies', async (req, res) => {
    const movie = await req.client.createMovie({
      title: 'The Matrix'
    })
    return movie
  })

  app.get('/movies', async (req, res) => {
    return await req.client.getMovies()
  })

  const movie = await app.inject({
    method: 'POST',
    path: '/movies'
  })

  assert.deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: '/movies'
  })

  assert.deepEqual(movies.json(), [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI and auth', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
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

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('app decorator with OpenAPI', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'client'
  })

  app.post('/movies', async (req, res) => {
    const movie = await req.client.createMovie({
      title: 'The Matrix'
    })
    return movie
  })

  app.get('/movies', async (req, res) => {
    return await req.client.getMovies()
  })

  const movie = await app.inject({
    method: 'POST',
    path: '/movies'
  })

  assert.deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: '/movies'
  })

  assert.deepEqual(movies.json(), [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'client',
    async getHeaders (req, reply, options) {
      assert.equal(typeof req, 'object')
      assert.equal(typeof reply, 'object')

      const targetAppUrl = new URL(targetApp.url + '/movies/')
      assert.deepEqual(options.url, targetAppUrl)

      assert.equal(options.method, 'POST')
      assert.deepEqual(options.headers, {})
      assert.deepEqual(options.telemetryHeaders, {})
      assert.deepEqual(options.body, { title: 'The Matrix' })

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

  const response = res.json()
  console.log(response)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('validate response', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies',
    validateResponse: true
  })

  app.post('/', async (req) => {
    const movie = await req.movies.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  app.get('/allMovies', async (req) => {
    const movies = await req.movies.getMovies({})
    return movies
  })

  await app.inject({
    method: 'POST',
    url: '/'
  })

  const res = await app.inject({
    method: 'GET',
    url: '/allMovies'
  })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), [{
    id: 1,
    title: 'The Matrix'
  }])
})

test('req decorator with GraphQL and auth', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'graphql',
    url: `${targetApp.url}/graphql`,
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

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: '1',
    title: 'The Matrix'
  })
})

test('configureClient getHeaders', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies'
  })

  app.configureMovies({
    async getHeaders (req) {
      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async (req) => {
    const movie = await req.movies.createMovie({
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

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('serviceId', async (t) => {
  const agent = getGlobalDispatcher()
  t.after(() => {
    setGlobalDispatcher(agent)
  })
  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  // Provide the base url to the request
  const mockPool = mockAgent.get('http://movies.plt.local')

  // intercept the request
  mockPool.intercept({
    path: '/movies/',
    method: 'POST',
    body: JSON.stringify({
      title: 'The Matrix'
    })
  }).reply(200, {
    id: 1,
    title: 'The Matrix'
  })

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    serviceId: 'movies',
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  })

  app.post('/movies', async (req, res) => {
    const movie = await req.client.createMovie({
      title: 'The Matrix'
    })
    return movie
  })

  const movie = await app.inject({
    method: 'POST',
    path: '/movies'
  })

  assert.deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

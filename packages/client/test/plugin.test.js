import { create } from '@platformatic/db'
import { safeRemove } from '@platformatic/foundation'
import Fastify from 'fastify'
import { deepEqual, equal, rejects } from 'node:assert/strict'
import { cp, mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'
import client from '../fastify-plugin.js'
import { WrongOptsTypeError } from '../lib/errors.js'
import './helper.js'

test('wrong type', async t => {
  const app = Fastify()

  await rejects(async () => {
    return await app.register(client, {
      fullRequest: false,
      fullResponse: false,
      type: 'foo',
      url: 'http://localhost:3042/documentation/json',
      name: 'client'
    })
  }, new WrongOptsTypeError())
})

test('default decorator', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    fullRequest: false,
    fullResponse: false
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

  deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: '/movies'
  })

  deepEqual(movies.json(), [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI and auth', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    fullRequest: false,
    fullResponse: false,
    async getHeaders (req) {
      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async req => {
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

  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('app decorator with OpenAPI', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    fullRequest: false,
    fullResponse: false,
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

  deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: '/movies'
  })

  deepEqual(movies.json(), [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with OpenAPI', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    fullRequest: false,
    fullResponse: false,
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'client',
    async getHeaders (req, reply, options) {
      equal(typeof req, 'object')
      equal(typeof reply, 'object')

      const targetAppUrl = new URL(targetApp.url + '/movies/')
      deepEqual(options.url, targetAppUrl)

      equal(options.method, 'POST')
      deepEqual(options.headers, {})
      deepEqual(options.telemetryHeaders, {})
      deepEqual(options.body, { title: 'The Matrix' })

      return {
        'x-platformatic-admin-secret': req.headers['x-platformatic-admin-secret']
      }
    }
  })

  app.post('/', async req => {
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

  equal(res.statusCode, 200)
  deepEqual(response, {
    id: 1,
    title: 'The Matrix'
  })
})

test('validate response', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'movies')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    fullRequest: false,
    fullResponse: false,
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies',
    validateResponse: true
  })

  app.post('/', async req => {
    const movie = await req.movies.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  app.get('/allMovies', async req => {
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

  equal(res.statusCode, 200)
  deepEqual(res.json(), [
    {
      id: 1,
      title: 'The Matrix'
    }
  ])
})

test('req decorator with GraphQL and auth', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
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

  app.post('/', async req => {
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

  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    id: '1',
    title: 'The Matrix'
  })
})

test('configureClient getHeaders', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'auth')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()

  const app = Fastify()

  await app.register(client, {
    fullRequest: false,
    fullResponse: false,
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

  app.post('/', async req => {
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

  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

test('applicationId', async t => {
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
  mockPool
    .intercept({
      path: '/movies/',
      method: 'POST',
      body: JSON.stringify({
        title: 'The Matrix'
      })
    })
    .reply(200, {
      id: 1,
      title: 'The Matrix'
    })

  const app = Fastify()

  await app.register(client, {
    fullRequest: false,
    fullResponse: false,
    type: 'openapi',
    applicationId: 'movies',
    path: join(import.meta.dirname, 'fixtures', 'movies', 'openapi.json')
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

  deepEqual(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })
})

'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { unlink, mkdtemp, cp, rm } = require('node:fs/promises')
const { buildServer } = require('../../db')
const { buildOpenAPIClient } = require('..')
require('./helper')

test('rejects with no url', async (t) => {
  await assert.rejects(buildOpenAPIClient())
  await assert.rejects(buildOpenAPIClient({}))
  await assert.rejects(buildOpenAPIClient({
    path: join(__dirname, 'fixtures', 'movies', 'openapi.json')
  }))
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

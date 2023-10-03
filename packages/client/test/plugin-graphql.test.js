'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { mkdtemp, cp, unlink, rm } = require('node:fs/promises')
const Fastify = require('fastify')
const { buildServer } = require('../../db')
const client = require('..')
require('./helper')

test('app decorator with GraphQL', async (t) => {
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
    type: 'graphql',
    url: `${targetApp.url}/graphql`,
    name: 'client'
  })

  app.post('/movies', async (req, res) => {
    return await req.client.graphql({
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
  })

  app.get('/movies', async (req, res) => {
    return await req.client.graphql({
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
  })

  const movie = await app.inject({
    method: 'POST',
    path: '/movies'
  })

  assert.deepEqual(movie.json(), {
    id: '1',
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: 'movies'
  })

  assert.deepEqual(movies.json(), {
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

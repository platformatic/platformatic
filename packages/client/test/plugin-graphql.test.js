import { create } from '@platformatic/db'
import { safeRemove } from '@platformatic/foundation'
import Fastify from 'fastify'
import { deepEqual } from 'node:assert/strict'
import { cp, mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import client from '../fastify-plugin.js'
import './helper.js'

test('app decorator with GraphQL', async t => {
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

  deepEqual(movie.json(), {
    id: '1',
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: 'movies'
  })

  deepEqual(movies.json(), {
    movies: [
      {
        id: '1',
        title: 'The Matrix'
      }
    ],
    getMovieById: {
      id: '1',
      title: 'The Matrix'
    }
  })
})

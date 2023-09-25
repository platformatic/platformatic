'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('../../db')
const { join } = require('path')
const client = require('..')
const fs = require('fs/promises')
const Fastify = require('fastify')

test('app decorator with GraphQL', async ({ teardown, same, rejects }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
  } catch {
    // noop
  }
  const targetApp = await buildServer(join(__dirname, 'fixtures', 'movies', 'platformatic.db.json'))

  teardown(async () => {
    await targetApp.close()
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

  same(movie.json(), {
    id: 1,
    title: 'The Matrix'
  })

  const movies = await app.inject({
    method: 'GET',
    path: 'movies'
  })

  same(movies.json(), {
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

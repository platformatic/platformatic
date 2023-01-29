'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('@platformatic/db')
const { join } = require('path')
const { buildOpenAPIClient } = require('..')
const fs = require('fs/promises')

test('build basic client from url', async ({ teardown, same }) => {
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
})

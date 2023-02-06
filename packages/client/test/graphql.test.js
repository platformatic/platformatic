'user strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('@platformatic/db')
const { join } = require('path')
const { buildGraphQLClient } = require('..')
const fs = require('fs/promises')

test('rejects with no url', async ({ rejects }) => {
  await rejects(buildGraphQLClient())
  await rejects(buildGraphQLClient({}))
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

test('build basic client from url with custom headers function', async ({ teardown, same, rejects }) => {
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
    async headers () {
      return {
        'x-platformatic-admin-secret': 'changeme'
      }
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

  await rejects(client.graphql({
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
    `,
    headers: {
      'x-platformatic-admin-secret': 'thisiswrong'
    }
  }))
})

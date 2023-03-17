'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')
const { request } = require('undici')
const { join } = require('path')

test('graphql enabled', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      graphql: true
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `
      })
    })
    equal(res.statusCode, 200, 'hello status code')
    same(await res.body.json(), {
      data: {
        hello: 'world'
      }
    }, 'hello response')
  }

  {
    const res = await request(`${server.url}/graphiql`)
    equal(res.statusCode, 200, 'graphiql status code')
  }
})

test('graphql disabled', async ({ teardown, equal, fail }) => {
  try {
    const server = await buildServer(buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        graphql: false
      },
      plugins: {
        paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    }))
    await server.stop()
    fail('should have errored but did not')
  } catch (err) {
    equal(err.message, 'Cannot read properties of undefined (reading \'extendSchema\')')
  }
})

test('disable graphiql', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      graphql: {
        graphiql: false
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `
      })
    })
    equal(res.statusCode, 200, 'hello status code')
    same(await res.body.json(), {
      data: {
        hello: 'world'
      }
    }, 'hello response')
  }

  {
    const res = await request(`${server.url}/graphiql`)
    equal(res.statusCode, 404, 'graphiql status code')
  }
})

test('graphql disabled by default', async ({ teardown, equal, fail }) => {
  try {
    const server = await buildServer(buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      plugins: {
        paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    }))
    await server.stop()
    fail('should have errored but did not')
  } catch (err) {
    equal(err.message, 'Cannot read properties of undefined (reading \'extendSchema\')')
  }
})

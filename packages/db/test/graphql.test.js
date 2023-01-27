'use strict'

const { buildConfig, connInfo } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { join } = require('path')

test('extend schema via config', async ({ teardown, equal, same }) => {
  const schema = `
  extend type Query {
    names: [String]
  }
  `
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo,
      graphql: {
        schema
      }
    },
    migrations: {
      dir: join(__dirname, 'fixtures', 'migrations')
    },
    plugin: {
      path: join(__dirname, 'fixtures', 'name-resolver.js')
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
            names
          }
        `
      })
    })
    equal(res.statusCode, 200, 'names status code')
    same(await res.body.json(), {
      data: {
        names: ['John', 'Jane']
      }
    }, 'namesresponse')
  }
})

test('extend schema via path', async ({ teardown, equal, same }) => {
  const server = await buildServer(join(__dirname, 'fixtures', 'name-resolver.db.json'))
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
            names
          }
        `
      })
    })
    equal(res.statusCode, 200, 'names status code')
    same(await res.body.json(), {
      data: {
        names: ['John', 'Jane']
      }
    }, 'namesresponse')
  }
})

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
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo,
      graphql: {
        schema
      }
    },
    migrations: {
      dir: join(__dirname, 'fixtures', 'migrations')
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'name-resolver.js')]
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
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
  const app = await buildServer(join(__dirname, 'fixtures', 'name-resolver.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
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

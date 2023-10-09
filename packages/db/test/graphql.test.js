'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo } = require('./helper')

test('extend schema via config', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const schema = `
  extend type Query {
    names: [String]
  }
  `

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo,
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
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
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
    assert.equal(res.statusCode, 200, 'names status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        names: ['John', 'Jane']
      }
    }, 'namesresponse')
  }
})

test('extend schema via path', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'error'
      }
    },
    db: {
      ...connectionInfo,
      graphql: {
        schemaPath: join(__dirname, 'fixtures', 'names.graphql')
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'name-resolver.js')]
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
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
    assert.equal(res.statusCode, 200, 'names status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        names: ['John', 'Jane']
      }
    }, 'namesresponse')
  }
})

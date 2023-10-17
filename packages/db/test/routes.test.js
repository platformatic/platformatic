'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo } = require('./helper')

test('should respond 200 on root endpoint', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
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
    // No browser (i.e. curl)
    const res = await (request(`${app.url}/`))
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    // browser
    const res = await (request(`${app.url}/`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    }))
    const html = await res.body.text()
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'text/html; charset=UTF-8')
    // has links to OpenAPI/GraphQL docs
    assert.ok(html.includes('<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>'))
    assert.ok(html.includes('<a id="graphql-link" target="_blank" class="button-link">GraphiQL</a>'))
  }
})

test('should not overwrite a plugin which define a root endpoint', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  const res = await (request(`${app.url}/`))
  assert.equal(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepEqual(body, { message: 'Root Plugin' })
})

test('should exclude the root endpoint from the openapi documentation', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  const res = await (request(`${app.url}/documentation/json`))
  const openapi = await res.body.json()
  assert.equal(res.statusCode, 200)
  assert.equal(openapi.paths['/'], undefined)
})

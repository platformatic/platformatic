'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
const { request } = require('undici')
const { join } = require('path')

test('should respond 200 on root endpoint', async ({ teardown, equal, same, match }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connInfo
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    // No browser (i.e. curl)
    const res = await (request(`${app.url}/`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  {
    // browser
    const res = await (request(`${app.url}/`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    }))
    const html = await res.body.text()
    equal(res.statusCode, 200)
    equal(res.headers['content-type'], 'text/html; charset=UTF-8')
    // has links to OpenAPI/GraphQL docs
    match(html, '<a id="openapi-link" target="_blank">OpenAPI Documentation</a>')
    match(html, '<a id="graphql-link" target="_blank">GraphiQL</a>')
  }
})

test('should not overwrite a plugin which define a root endpoint', async ({ teardown, equal, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connInfo
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/`))
  equal(res.statusCode, 200)
  const body = await res.body.json()
  same(body, { message: 'Root Plugin' })
})

test('should not overwrite dashboard endpoint', async ({ teardown, equal, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: true
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/`))
  equal(res.statusCode, 302)
  equal(res.headers.location, '/dashboard')
})

test('should exclude the root endpoint from the openapi documentation', async ({ teardown, equal, has }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: false
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/documentation/json`))
  const openapi = await res.body.json()
  equal(res.statusCode, 200)
  has(openapi.paths, { '/': undefined })
})

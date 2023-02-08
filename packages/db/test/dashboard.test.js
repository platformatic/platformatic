'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
const { request } = require('undici')

const sharedConfig = {
  server: {
    hostname: '127.0.0.1',
    logger: { level: 'error' },
    port: 0
  },
  core: {
    ...connInfo
  },
  authorization: {
    adminSecret: 'secret'
  }
}
test('should serve the dashboard on root endpoint if the dashboard option is enabled', async ({ teardown, equal }) => {
  const server = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: true
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, '/dashboard')
  }

  await server.restart({
    ...sharedConfig,
    dashboard: {}
  })
  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, '/dashboard')
  }
})

test('should serve the dashboard if any dashboard configuration option is set', async ({ teardown, equal }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      logger: { level: 'error' },
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: {
      path: '/'
    }
  }))
  teardown(server.stop)

  await server.listen()
  const res = await request(`${server.url}/`)
  equal(res.statusCode, 200)
})

test('should not serve the dashboard if the dashboard configuration option is disabled or not set', async ({ teardown, equal }) => {
  const server = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: false
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await request(`${server.url}/dashboard`)
    equal(res.statusCode, 404)
  }

  await server.restart({
    ...sharedConfig,
    dashboard: undefined
  })
  {
    const res = await request(`${server.url}/dashboard`)
    equal(res.statusCode, 404)
  }
})

test('should serve the dashboard on custom endpoint', async ({ teardown, equal, match, notMatch }) => {
  const server = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: {
      path: '/my-dashboard'
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await request(`${server.url}/my-dashboard`)
    equal(res.statusCode, 200)
    const html = await res.body.text()
    match(html, '<title>Platformatic DB</title>')
    match(html, '<div id="root"></div>') // it's the react app dashboard
    notMatch(html, '<h1>Welcome to Platformatic DB</h1>') // it's not the basic root-endpoint
  }

  {
    // Root endpoint should exist
    const res = await request(`${server.url}/`)
    const json = await res.body.json()
    equal(res.statusCode, 200)
    match(json, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }
})

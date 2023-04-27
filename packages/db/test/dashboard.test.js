'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
const { request } = require('undici')
const { join } = require('path')

const sharedConfig = {
  server: {
    hostname: '127.0.0.1',
    logger: { level: 'error' },
    port: 0
  },
  db: {
    ...connInfo
  },
  authorization: {
    adminSecret: 'secret'
  }
}
test('should serve the dashboard on root endpoint if the dashboard option is enabled', async ({ teardown, equal }) => {
  const app = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: true
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, '/dashboard')
  }

  await app.restart({
    ...sharedConfig,
    dashboard: {}
  })
  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, '/dashboard')
  }
})

test('should serve the dashboard if any dashboard configuration option is set', async ({ teardown, equal }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      logger: { level: 'error' },
      port: 0
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: {
      path: '/'
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/`)
  equal(res.statusCode, 200)
})

test('should not serve the dashboard if the dashboard configuration option is disabled or not set', async ({ teardown, equal }) => {
  const app = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: false
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/dashboard`)
    equal(res.statusCode, 404)
  }

  await app.restart({
    ...sharedConfig,
    dashboard: undefined
  })
  {
    const res = await request(`${app.url}/dashboard`)
    equal(res.statusCode, 404)
  }
})

test('should serve the dashboard on custom endpoint', async ({ teardown, equal, match, notMatch }) => {
  const dashboardPath = '/my-dashboard'
  const app = await buildServer(buildConfig({
    ...sharedConfig,
    dashboard: {
      path: `/${dashboardPath}`
    },
    plugins: {
      paths: [{
        path: join(__dirname, 'fixtures', 'root-endpoint-plugin.js')
      }]
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/${dashboardPath}`)
    equal(res.statusCode, 200)
    const html = await res.body.text()
    match(html, '<title>Platformatic DB</title>')
    match(html, '<div id="root"></div>') // it's the react app dashboard
    notMatch(html, '<h1>Welcome to Platformatic DB</h1>') // it's not the basic root-endpoint
  }
  {
    // Assets are served from root endpoint
    const res = await request(`${app.url}/images/favicon.ico`)
    equal(res.statusCode, 200)
    equal(res.headers['content-type'], 'image/vnd.microsoft.icon')
  }

  {
    // Root endpoint should exist
    const res = await request(`${app.url}/`)
    const json = await res.body.json()
    equal(res.statusCode, 200)
    match(json, { message: 'Root Plugin' })
  }
})

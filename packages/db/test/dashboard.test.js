'use strict'

const { test } = require('tap') 
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
const { request } = require('undici')

test('should serve the dashboard if the dashboard option is enabled', async ({ teardown, equal }) => {
  const sharedConfig = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const server = buildServer(buildConfig({
    ...sharedConfig,
    dashboard: true
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, "/dashboard")
  }

  await server.restart({
    ...sharedConfig,
    dashboard: {}
  })
  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 302)
    equal(res.headers.location, "/dashboard")
  }
})

test('should serve the dashboard if any dashboard configuration option is set', async ({ teardown, equal }) => {
  const server = buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    },
    dashboard: {
      rootPath: true
    }
  }))
  teardown(server.stop)

  await server.listen()
  const res = await request(`${server.url}/`)
  equal(res.statusCode, 302)
  equal(res.headers.location, "/dashboard")
})

test('should not serve the dashboard if the dashboard configuration option is disabled or not set', async ({ teardown, equal }) => {
  const sharedConfig = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const server = buildServer(buildConfig({
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
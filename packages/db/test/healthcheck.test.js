'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
const { request } = require('undici')

test('healthcheck route enabled with interval', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
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
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { status: 'ok' })
  }

  {
    await server.app.platformatic.db.dispose()
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 503)
    const body = await res.body.json()
    same(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

test('healthcheck route enabled without interval', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: true
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { status: 'ok' })
  }

  {
    await server.app.platformatic.db.dispose()
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 503)
    const body = await res.body.json()
    same(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

test('healthcheck route disabled', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)

  await server.listen()
  const res = await (request(`${server.url}/status`))
  equal(res.statusCode, 404)
})

test('healthcheck route enabled with interval and maxEventLoopUtilization', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000,
        maxEventLoopUtilization: 0.98
      }
    },
    db: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { status: 'ok' })
  }

  {
    await server.app.platformatic.db.dispose()
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 503)
    const body = await res.body.json()
    same(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

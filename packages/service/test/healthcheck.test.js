'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
require('./helper')
const { request } = require('undici')

test('healthcheck route enabled with interval', async ({ teardown, equal, same }) => {
  let check = true
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        interval: 2000,
        fn: function () {
          return check
        }
      }
    },
    metrics: false
  })
  teardown(server.stop)

  await server.listen()
  {
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { status: 'ok' })
  }

  check = false

  {
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

  check = true
})

test('healthcheck route enabled without interval', async ({ teardown, equal, same }) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: true
    },
    metrics: false
  })
  teardown(server.stop)

  await server.listen()
  {
    const res = await (request(`${server.url}/status`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { status: 'ok' })
  }
})

test('healthcheck route disabled', async ({ teardown, equal, same }) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: false
  })
  teardown(server.stop)

  await server.listen()
  const res = await (request(`${server.url}/status`))
  equal(res.statusCode, 404)
})

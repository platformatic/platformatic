'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer, platformaticService } = require('..')
const { request } = require('undici')

test('CORS is disabled by default', async ({ teardown, equal, pass, same }) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  // handles login
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/login`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      Origin: 'https://foo.bar.org'
    }
  }))
  equal(res.statusCode, 404)
})

test('CORS can be enabled', async ({ teardown, equal, pass, same }) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })
  teardown(server.stop)
  await server.listen()
  const res = await (request(`${server.url}/_admin/login`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      Origin: 'https://foo.bar.org'
    }
  }))
  equal(res.statusCode, 204)
  equal(res.headers['access-control-allow-origin'], 'https://foo.bar.org')
  equal(res.headers['access-control-allow-methods'], 'GET, POST')
})

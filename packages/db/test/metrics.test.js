'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo, createBasicPages, clear } = require('./helper')
const { request } = require('undici')

test('call /dashboard/metrics before any requests', async ({ teardown, equal, same, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    dashboard: true,
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  const { port } = await server.listen()

  const res = await (request(`http://127.0.0.1:${port}/dashboard/metrics`))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^application\/json/)
  try {
    const body = await res.body.json()

    same(body.reqMetrics, {})
    equal(body.failureRate, 0)
    equal(body.totalReqCount, 0)
  } catch (err) {
    fail()
  }
})

test('call /dashboard/metrics after user requests', async ({ teardown, equal, has, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    dashboard: true,
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  const { port } = await server.listen()

  const authHeaders = {
    'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
  }

  await Promise.all([
    server.inject({ method: 'GET', url: '/pages' }),
    server.inject({ method: 'GET', url: '/pages', headers: authHeaders }),
    server.inject({ method: 'GET', url: '/pages', headers: authHeaders }),
    server.inject({ method: 'GET', url: '/pages/0' }),
    server.inject({ method: 'GET', url: '/pages/0', headers: authHeaders }),
    server.inject({ method: 'POST', url: '/pages/0', body: {} }),
    server.inject({ method: 'POST', url: '/graphql', headers: authHeaders, body: {} })
  ])

  const res = await (request(`http://127.0.0.1:${port}/dashboard/metrics`))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^application\/json/)
  try {
    const body = await res.body.json()

    const expectedReqMetrics = {
      GET: {
        '/pages': {
          reqCountPerStatusCode: { 200: 2, 401: 1 },
          totalReqCount: 3,
          failureRate: 0.33
        },
        '/pages/:id': {
          reqCountPerStatusCode: { 401: 1 },
          totalReqCount: 1,
          failureRate: 1
        },
        __unknown__: {
          reqCountPerStatusCode: { 404: 1 },
          totalReqCount: 1,
          failureRate: 1
        }
      },
      POST: {
        '/pages/:id': {
          reqCountPerStatusCode: { 401: 1 },
          totalReqCount: 1,
          failureRate: 1
        },
        '/graphql': {
          reqCountPerStatusCode: { 400: 1 },
          totalReqCount: 1,
          failureRate: 1
        }
      }
    }

    has(body.reqMetrics, expectedReqMetrics)
    equal(body.failureRate, 0.71)
    equal(body.totalReqCount, 7)
  } catch (err) {
    fail()
  }
})

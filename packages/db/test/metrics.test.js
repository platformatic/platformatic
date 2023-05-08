'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo, createBasicPages, clear } = require('./helper')
const { request } = require('undici')

test('call /dashboard/metrics before any requests', async ({ teardown, equal, same, fail, match }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    db: {
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

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/dashboard/metrics`))
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
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    db: {
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

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const authHeaders = {
    'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
  }

  await Promise.all([
    app.inject({ method: 'GET', url: '/pages' }),
    app.inject({ method: 'GET', url: '/pages', headers: authHeaders }),
    app.inject({ method: 'GET', url: '/pages', headers: authHeaders }),
    app.inject({ method: 'GET', url: '/pages/0' }),
    app.inject({ method: 'GET', url: '/pages/0', headers: authHeaders }),
    app.inject({ method: 'PUT', url: '/pages/0', body: {} }),
    app.inject({ method: 'POST', url: '/graphql', headers: authHeaders, body: {} })
  ])

  const res = await (request(`${app.url}/dashboard/metrics`))
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
      PUT: {
        '/pages/:id': {
          reqCountPerStatusCode: { 401: 1 },
          totalReqCount: 1,
          failureRate: 1
        }
      },
      POST: {
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

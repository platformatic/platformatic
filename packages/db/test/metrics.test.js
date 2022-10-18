'use strict'

const { test, equal } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo, createBasicPages, clear } = require('./helper')
const { request } = require('undici')

test('has /metrics endpoint on default prometheus port', async ({ teardown, equal, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request('http://127.0.0.1:9090/metrics'))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  try {
    testPrometheusOutput(body)
  } catch (err) {
    fail()
  }
})

test('has /metrics endpoint with accept application/json', async ({ teardown, equal, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request(
    'http://127.0.0.1:9090/metrics',
    {
      headers: {
        accept: 'application/json'
      }
    }
  ))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^application\/json/)
  try {
    const json = await res.body.json()
    testPrometheusJsonOutput(json)
  } catch (err) {
    fail()
  }
})

test('has /metrics endpoint on configured port', async ({ teardown, equal, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      port: 9999
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  const res = await (request('http://127.0.0.1:9999/metrics'))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  try {
    testPrometheusOutput(body)
  } catch (err) {
    fail()
  }
})

test('support basic auth', async ({ teardown, equal, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      auth: {
        username: 'foo',
        password: 'bar'
      }
    },
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  {
    const res = await (request('http://127.0.0.1:9090/metrics'))
    equal(res.statusCode, 401)
    match(res.headers['content-type'], /^application\/json/)
  }

  {
    // wrong credentials
    const res = await (request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('bar:foo').toString('base64')}`
      }
    }))
    equal(res.statusCode, 401)
    match(res.headers['content-type'], /^application\/json/)
  }

  {
    const res = await (request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('foo:bar').toString('base64')}`
      }
    }))
    equal(res.statusCode, 200)
    match(res.headers['content-type'], /^text\/plain/)
    const body = await res.body.text()
    try {
      testPrometheusOutput(body)
    } catch (err) {
      fail()
    }
  }
})

function testPrometheusJsonOutput (output) {
  for (const metric of output) {
    equal(typeof metric.help, 'string', 'metric.help is string')
    equal(typeof metric.name, 'string', 'metric.name is string')
    equal(typeof metric.type, 'string', 'metric.type is string')
    equal(typeof metric.aggregator, 'string', 'metric.aggregator is string')
    equal(Array.isArray(metric.values), true, 'metric.values is array')
  }
}
function testPrometheusOutput (output) {
  let metricBlock = []
  const lines = output.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') {
      // check this metric set
      checkMetricBlock(metricBlock)
      metricBlock = []
    } else {
      metricBlock.push(line)
    }
  }
}

function checkMetricBlock (metricBlock) {
  if (!metricBlock[0].match(/^# HELP/)) {
    throw new Error('First line should be HELP')
  }

  if (!metricBlock[1].match(/^# TYPE/)) {
    throw new Error('Second line should be TYPE')
  }
  for (let i = 2; i < metricBlock.length; i++) {
    const split = metricBlock[i].split(' ')
    if (split.length !== 2) {
      throw new Error(`Bad format for metric: ${metricBlock[i]}`)
    }
  }
  return true
}

test('do not error on restart', async ({ teardown, equal, fail, match }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true,
    core: {
      ...connInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }))
  teardown(server.stop)
  await server.listen()
  await server.restart()

  const res = await (request('http://127.0.0.1:9090/metrics'))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  try {
    testPrometheusOutput(body)
  } catch (err) {
    fail()
  }
})

test('call /metrics/dashboard before any requests', async ({ teardown, equal, same, fail, match }) => {
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

test('call /metrics/dashboard after user requests', async ({ teardown, equal, has, fail, match }) => {
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

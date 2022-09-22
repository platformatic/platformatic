'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig, connInfo } = require('./helper')
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

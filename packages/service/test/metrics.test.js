'use strict'

// setup the undici agent
require('./helper')

const { test, equal } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { promisify } = require('util')
const sleep = promisify(setTimeout)

test('has /metrics endpoint on default prometheus port', async ({ teardown, equal, fail, match }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  // needed to reach 100% code cov, otherwise the ELU check won't run
  await sleep(120)
  const res = await (request('http://127.0.0.1:9090/metrics'))
  const body = await res.body.text()
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  testPrometheusOutput(body)
})

test('has /metrics endpoint with accept application/json', async ({ teardown, equal, fail, match }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(
    'http://127.0.0.1:9090/metrics',
    {
      headers: {
        accept: 'application/json'
      }
    }
  ))
  match(res.headers['content-type'], /^application\/json/)
  const json = await res.body.json()
  equal(res.statusCode, 200)
  testPrometheusJsonOutput(json)
})

test('has /metrics endpoint on configured port', async ({ teardown, equal, fail, match }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      port: 9999
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request('http://127.0.0.1:9999/metrics'))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('support basic auth', async ({ teardown, equal, fail, match }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      auth: {
        username: 'foo',
        password: 'bar'
      }
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

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
    testPrometheusOutput(body)
  }
})

test('do not error on restart', async ({ teardown, equal, fail, match }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()
  await app.restart()

  const res = await (request('http://127.0.0.1:9090/metrics'))
  equal(res.statusCode, 200)
  match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('restarting 10 times does not leak', async ({ teardown, equal, fail, match }) => {
  process.on('warning', (warning) => {
    fail('warning was raised')
  })
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  teardown(async () => {
    await app.close()
  })

  await app.start()

  for (let i = 0; i < 10; i++) {
    await app.restart()
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

function testPrometheusJsonOutput (output) {
  for (const metric of output) {
    equal(typeof metric.help, 'string', 'metric.help is string')
    equal(typeof metric.name, 'string', 'metric.name is string')
    equal(typeof metric.type, 'string', 'metric.type is string')
    equal(typeof metric.aggregator, 'string', 'metric.aggregator is string')
    equal(Array.isArray(metric.values), true, 'metric.values is array')
  }
}

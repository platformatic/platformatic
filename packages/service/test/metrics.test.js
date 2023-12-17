'use strict'

// setup the undici agent
require('./helper')

const assert = require('node:assert')
const { test } = require('node:test')
const { setTimeout } = require('node:timers/promises')
const { request } = require('undici')
const { buildServer } = require('..')

test('has /metrics endpoint on default prometheus port', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  // needed to reach 100% code cov, otherwise the ELU check won't run
  await setTimeout(120)
  const res = await (request('http://127.0.0.1:9090/metrics'))
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  testPrometheusOutput(body)
})

test('has /metrics endpoint with accept application/json', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  t.after(async () => {
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
  assert.match(res.headers['content-type'], /^application\/json/)
  const json = await res.body.json()
  assert.strictEqual(res.statusCode, 200)
  testPrometheusJsonOutput(json)
})

test('has /metrics endpoint on configured port', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      port: 9999
    }
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request('http://127.0.0.1:9999/metrics'))
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('support basic auth', async (t) => {
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

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request('http://127.0.0.1:9090/metrics'))
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    // wrong credentials
    const res = await (request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('bar:foo').toString('base64')}`
      }
    }))
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    const res = await (request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('foo:bar').toString('base64')}`
      }
    }))
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/plain/)
    const body = await res.body.text()
    testPrometheusOutput(body)
  }
})

test('has /metrics endpoint on parent server', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 3042
    },
    metrics: {
      server: 'parent'
    }
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request('http://127.0.0.1:3042/metrics'))
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('do not error on restart', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()
  await app.restart()

  const res = await (request('http://127.0.0.1:9090/metrics'))
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('restarting 10 times does not leak', async (t) => {
  process.on('warning', (warning) => {
    assert.fail('warning was raised')
  })
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: true
  })

  t.after(async () => {
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
    assert.strictEqual(typeof metric.help, 'string', 'metric.help is string')
    assert.strictEqual(typeof metric.name, 'string', 'metric.name is string')
    assert.strictEqual(typeof metric.type, 'string', 'metric.type is string')
    assert.strictEqual(typeof metric.aggregator, 'string', 'metric.aggregator is string')
    assert.strictEqual(Array.isArray(metric.values), true, 'metric.values is array')
  }
}

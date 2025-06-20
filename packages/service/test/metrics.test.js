'use strict'

// setup the undici agent
require('./helper')

const assert = require('node:assert')
const { test } = require('node:test')
const { setTimeout } = require('node:timers/promises')
const { request } = require('undici')
const { createStackableFromConfig } = require('./helper')

test('should auto set server to "parent" if port conflict', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3042,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'own',
      port: 3042
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const configManager = app.configManager
  const config = configManager.current
  assert.strictEqual(config.metrics.server, 'parent')
})

test('has /metrics endpoint on default prometheus port', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    metrics: true
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  // needed to reach 100% code cov, otherwise the ELU check won't run
  await setTimeout(120)
  const res = await request('http://127.0.0.1:9090/metrics')
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  testPrometheusOutput(body)
})

test('has /metrics endpoint with accept application/json', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    metrics: true
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request('http://127.0.0.1:9090/metrics', {
    headers: {
      accept: 'application/json'
    }
  })
  assert.match(res.headers['content-type'], /^application\/json/)
  const json = await res.body.json()
  assert.strictEqual(res.statusCode, 200)
  testPrometheusJsonOutput(json)
})

test('has /metrics endpoint on configured port', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    metrics: {
      port: 9999
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request('http://127.0.0.1:9999/metrics')
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('support basic auth', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    metrics: {
      auth: {
        username: 'foo',
        password: 'bar'
      }
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request('http://127.0.0.1:9090/metrics')
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    // wrong credentials
    const res = await request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('bar:foo').toString('base64')}`
      }
    })
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    const res = await request('http://127.0.0.1:9090/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('foo:bar').toString('base64')}`
      }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/plain/)
    const body = await res.body.text()
    testPrometheusOutput(body)
  }
})

test('has /metrics endpoint on parent server', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3042,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'parent'
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request('http://127.0.0.1:3042/metrics')
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)
  const body = await res.body.text()
  testPrometheusOutput(body)
})

test('support basic auth with metrics on parent server', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3042,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'parent',
      auth: {
        username: 'foo',
        password: 'bar'
      }
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request('http://127.0.0.1:3042/metrics')
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    // wrong credentials
    const res = await request('http://127.0.0.1:3042/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('bar:foo').toString('base64')}`
      }
    })
    assert.strictEqual(res.statusCode, 401)
    assert.match(res.headers['content-type'], /^application\/json/)
  }

  {
    const res = await request('http://127.0.0.1:3042/metrics', {
      headers: {
        authorization: `Basic ${Buffer.from('foo:bar').toString('base64')}`
      }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/plain/)
    const body = await res.body.text()
    testPrometheusOutput(body)
  }
})

test('should not expose metrics if server hide is set', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3042,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'hide'
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  try {
    await request('http://127.0.0.1:9090/metrics')
  } catch (err) {
    assert.strictEqual(err.code, 'ECONNREFUSED')
  }

  const res = await request('http://127.0.0.1:3042/metrics')
  assert.strictEqual(res.statusCode, 404)
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

function findFirstPrometheusLineForMetric (metric, output) {
  const lines = output.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith(metric)) {
      return line
    }
  }
}

function parseLabels (line) {
  return line
    .split('{')[1]
    .split('}')[0]
    .split(',')
    .reduce((acc, label) => {
      const [key, value] = label.split('=')
      acc[key] = value.replace(/^"(.*)"$/, '$1')
      return acc
    }, {})
}

test('specify custom labels', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 30001,
      logger: { level: 'fatal' }
    },
    metrics: {
      labels: {
        foo: 'bar'
      }
    }
  })

  await app.init()

  app.getApplication().get('/test', async (req, reply) => {
    return { hello: 'world' }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  // needed to reach 100% code cov, otherwise the ELU check won't run
  await setTimeout(120)
  // We do a get to trigger the route metrics
  await request('http://127.0.0.1:30001/test')
  const res = await request('http://127.0.0.1:9090/metrics')
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.match(res.headers['content-type'], /^text\/plain/)

  {
    const cpu = findFirstPrometheusLineForMetric('process_cpu_percent_usage', body)
    const labels = parseLabels(cpu)
    assert.strictEqual(labels.foo, 'bar')
  }

  {
    const eventLoop = findFirstPrometheusLineForMetric('nodejs_eventloop_utilization', body)
    const labels = parseLabels(eventLoop)
    assert.strictEqual(labels.foo, 'bar')
  }

  {
    const httpRequestSeconds = findFirstPrometheusLineForMetric('http_request_duration_seconds', body)
    const labels = parseLabels(httpRequestSeconds)
    assert.strictEqual(labels.foo, 'bar')
  }

  {
    const httpRequestSeconds = findFirstPrometheusLineForMetric('http_request_summary_seconds', body)
    const labels = parseLabels(httpRequestSeconds)
    assert.strictEqual(labels.foo, 'bar')
  }
  {
    const httpRequest = findFirstPrometheusLineForMetric('http_request_all_summary_seconds', body)
    const labels = parseLabels(httpRequest)
    assert.strictEqual(labels.foo, 'bar')
  }
})

test('specify different custom labels on two different services', async t => {
  const app1 = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3042,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'own',
      port: 3042,
      labels: {
        foo: 'bar1'
      }
    }
  })

  t.after(async () => {
    await app1.stop()
  })
  await app1.start({ listen: true })

  const app2 = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3043,
      logger: { level: 'fatal' }
    },
    metrics: {
      server: 'own',
      port: 3043,
      labels: {
        foo: 'bar2'
      }
    }
  })

  t.after(async () => {
    await app2.stop()
  })
  await app2.start({ listen: true })

  // needed to reach 100% code cov, otherwise the ELU check won't run
  await setTimeout(120)

  {
    const res = await request('http://127.0.0.1:3042/metrics')
    const body = await res.body.text()
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/plain/)
    const heapSpace = findFirstPrometheusLineForMetric('nodejs_heap_space_size_total_bytes', body)
    const labels = parseLabels(heapSpace)
    assert.strictEqual(labels.foo, 'bar1')
  }

  {
    const res = await request('http://127.0.0.1:3043/metrics')
    const body = await res.body.text()
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/plain/)
    const heapSpace = findFirstPrometheusLineForMetric('nodejs_heap_space_size_total_bytes', body)
    const labels = parseLabels(heapSpace)
    assert.strictEqual(labels.foo, 'bar2')
  }
})

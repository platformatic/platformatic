'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const awsLambdaFastify = require('@fastify/aws-lambda')
const { buildConfig } = require('./helper')
const { buildServer } = require('..')

test('should respond 200 on root endpoint', async (t) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    }
  }))

  t.after(async () => {
    await app.close()
  })

  const handler = awsLambdaFastify(app)

  {
    // No browser (i.e. curl)
    const evt = {
      version: '2.0',
      httpMethod: 'GET',
      path: '/',
      headers: {
      },
      cookies: [],
      queryStringParameters: ''
    }

    const ret = await handler(evt)

    assert.strictEqual(ret.body, JSON.stringify({ message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }))
    assert.strictEqual(ret.isBase64Encoded, false)
    assert.ok(ret.headers)
    assert.strictEqual(ret.headers['content-type'], 'application/json; charset=utf-8')
    assert.strictEqual(ret.headers['content-length'], '81')
    assert.ok(ret.headers.date)
    assert.strictEqual(ret.headers.connection, 'keep-alive')
  }

  {
    // browser
    const evt = {
      version: '2.0',
      httpMethod: 'GET',
      path: '/',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      },
      cookies: [],
      queryStringParameters: ''
    }

    const ret = await handler(evt)

    // No browser (i.e. curl)
    assert.strictEqual(ret.isBase64Encoded, false)
    assert.ok(ret.headers)
    assert.strictEqual(ret.headers['content-type'], 'text/html; charset=UTF-8')
    assert.ok(ret.headers.date)
    assert.strictEqual(ret.headers.connection, 'keep-alive')
  }
})

test('from a config file on disk', async (t) => {
  const app = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  t.after(async () => {
    await app.close()
  })

  const handler = awsLambdaFastify(app)

  // No browser (i.e. curl)
  const evt = {
    version: '2.0',
    httpMethod: 'GET',
    path: '/',
    headers: {
    },
    cookies: [],
    queryStringParameters: ''
  }

  const ret = await handler(evt)

  assert.strictEqual(ret.body, JSON.stringify({ hello: 'world' }))
  assert.strictEqual(ret.isBase64Encoded, false)
  assert.ok(ret.headers)
  assert.strictEqual(ret.headers['content-type'], 'application/json; charset=utf-8')
  assert.strictEqual(ret.headers['content-length'], '17')
  assert.ok(ret.headers.date)
  assert.strictEqual(ret.headers.connection, 'keep-alive')
})

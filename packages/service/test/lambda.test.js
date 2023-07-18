'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')
const { join } = require('path')
const awsLambdaFastify = require('@fastify/aws-lambda')

test('should respond 200 on root endpoint', async ({ teardown, equal, same, ok }) => {
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

  teardown(async () => {
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

    equal(ret.body, JSON.stringify({ message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }))
    equal(ret.isBase64Encoded, false)
    ok(ret.headers)
    equal(ret.headers['content-type'], 'application/json; charset=utf-8')
    equal(ret.headers['content-length'], '81')
    ok(ret.headers.date)
    equal(ret.headers.connection, 'keep-alive')
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
    equal(ret.isBase64Encoded, false)
    ok(ret.headers)
    equal(ret.headers['content-type'], 'text/html; charset=UTF-8')
    ok(ret.headers.date)
    equal(ret.headers.connection, 'keep-alive')
  }
})

test('from a config file on disk', async ({ teardown, equal, same, ok }) => {
  const app = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  teardown(async () => {
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

  equal(ret.body, JSON.stringify({ hello: 'world' }))
  equal(ret.isBase64Encoded, false)
  ok(ret.headers)
  equal(ret.headers['content-type'], 'application/json; charset=utf-8')
  equal(ret.headers['content-length'], '17')
  ok(ret.headers.date)
  equal(ret.headers.connection, 'keep-alive')
})

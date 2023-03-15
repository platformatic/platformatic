'use strict'

const { test } = require('tap')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')
const { request } = require('undici')
const { join } = require('path')

test('should respond 200 on root endpoint', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    // No browser (i.e. curl)
    const res = await (request(`${server.url}/`))
    equal(res.statusCode, 200)
    const body = await res.body.json()
    same(body, { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  {
    // browser
    const res = await (request(`${server.url}/`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    }))

    equal(res.statusCode, 200)
    equal(res.headers['content-type'], 'text/html; charset=UTF-8')
  }
})

test('should not overwrite a plugin which define a root endpoint', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()
  const res = await (request(`${server.url}/`))
  equal(res.statusCode, 200)
  const body = await res.body.json()
  same(body, { message: 'Root Plugin' })
})

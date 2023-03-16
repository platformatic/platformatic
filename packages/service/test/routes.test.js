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

test('openapi enabled', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    // No browser (i.e. curl)
    const res = await (request(`${server.url}/documentation/json`))
    equal(res.statusCode, 200)
    const body = await res.body.json()

    equal(body.openapi, '3.0.3')
    equal(body.info.title, 'Platformatic')
    equal(body.info.version, '1.0.0')
    equal(!!body.paths['/'].get, true)
  }
})

test('openapi config', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    service: {
      openapi: {
        info: {
          title: 'My Service',
          version: '0.0.42',
          description: 'My Service is the best service ever'
        }
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    // No browser (i.e. curl)
    const res = await (request(`${server.url}/documentation/json`))
    equal(res.statusCode, 200)
    const body = await res.body.json()

    equal(body.openapi, '3.0.3')
    equal(body.info.title, 'My Service')
    equal(body.info.version, '0.0.42')
    equal(body.info.description, 'My Service is the best service ever')
    equal(!!body.paths['/'].get, true)
  }
})

test('openapi disabled', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      openapi: false
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  }))
  teardown(server.stop)

  await server.listen()
  {
    // No browser (i.e. curl)
    const res = await (request(`${server.url}/documentation/json`))
    equal(res.statusCode, 404)
    await res.body.text()
  }
})

test('openapi disabled by default', async ({ teardown, equal, same }) => {
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
  {
    // No browser (i.e. curl)
    const res = await (request(`${server.url}/documentation/json`))
    equal(res.statusCode, 404)
    await res.body.text()
  }
})

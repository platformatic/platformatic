'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { join } = require('path')

test('autoload & filesystem based routing / watch disabled', { only: true }, async ({ teardown, equal }) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: join(__dirname, 'fixtures', 'directories', 'routes')
    },
    watch: false,
    metrics: false
  }

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${server.url}/foo/bar`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${server.url}/foo/baz`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from baz', 'body')
  }
})

test('autoload & filesystem based routing / watch enabled', async ({ teardown, equal }) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: join(__dirname, 'fixtures', 'directories', 'routes')
    },
    watch: true,
    metrics: false
  }

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${server.url}/foo/bar`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${server.url}/foo/baz`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from baz', 'body')
  }
})

test('multiple files', async ({ teardown, equal }) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: [{
      path: join(__dirname, 'fixtures', 'directories', 'plugins')
    }, {
      path: join(__dirname, 'fixtures', 'directories', 'routes')
    }],
    watch: true,
    metrics: false
  }

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${server.url}/foo/bar`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${server.url}/foo/baz`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${server.url}/foo/with-decorator`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'bar', 'body')
  }
})

test('multiple files / watch false', async ({ teardown, equal }) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: [{
      path: join(__dirname, 'fixtures', 'directories', 'plugins')
    }, {
      path: join(__dirname, 'fixtures', 'directories', 'routes')
    }],
    watch: false,
    metrics: false
  }

  const server = await buildServer(config)
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${server.url}/foo/bar`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${server.url}/foo/baz`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${server.url}/foo/with-decorator`)
    equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    equal(body.hello, 'bar', 'body')
  }
})

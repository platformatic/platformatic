'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request, setGlobalDispatcher, getGlobalDispatcher, MockAgent } = require('undici')
const { randomUUID } = require('crypto')
const { join } = require('path')
const os = require('os')
const { writeFile } = require('fs/promises')

test('load and reload', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${randomUUID()}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    },
    watch: false,
    metrics: false
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'add status code')
    // The plugin is in Node's module cache, so the new value is not seen.
    same(await res.body.json(), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }
})

test('error', async ({ teardown, equal, pass, match }) => {
  const file = join(os.tmpdir(), `some-plugin-${randomUUID()}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
      app.get('/', () => {
        throw new Error('kaboom')
      })
    }`)

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    },
    watch: false,
    metrics: false
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/`)
  equal(res.statusCode, 500, 'add status code')
  match(await res.body.json(), {
    message: 'kaboom'
  })
})

test('mock undici is supported', async ({ teardown, equal, pass, same }) => {
  const previousAgent = getGlobalDispatcher()
  teardown(() => setGlobalDispatcher(previousAgent))

  const mockAgent = new MockAgent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
  setGlobalDispatcher(mockAgent)

  const mockPool = mockAgent.get('http://localhost:42')

  // intercept the request
  mockPool.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, {
    hello: 'world'
  })

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'undici-plugin.js')]
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/request`, {
    method: 'GET'
  })
  equal(res.statusCode, 200)
  same(await res.body.json(), {
    hello: 'world'
  })
})

test('load and reload ESM', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.mjs`)

  await writeFile(file, `
    export default async function (app) {
    }`
  )

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [file]
    }
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'status code')
    const data = await res.body.json()
    same(data, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  await writeFile(file, `
    export default async function (app) {
      app.get('/', () => "hello world" )
    }`)

  await app.restart()

  {
    const res = await request(`${app.url}/`)
    equal(res.statusCode, 200, 'add status code')
    // The plugin is in Node's module cache, so the new value is not seen.
    same(await res.body.json(), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }
})

'use strict'
// setup the undici agent
require('./helper')

const assert = require('node:assert')
const { test } = require('node:test')
const { createGunzip } = require('node:zlib')
const { pipeline } = require('node:stream/promises')
const { request } = require('undici')
const { buildServer, platformaticService } = require('..')

test('customize service', async (t) => {
  async function myApp (app, opts) {
    await platformaticService(app, opts, [async function (app) {
      app.get('/', () => 'hello world')
    }])
  }

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    }
  }, myApp)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url))
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

test('catch errors from the other side', async (t) => {
  async function myApp (app, opts) {
    await platformaticService(app, opts, [async function (app) {
      app.get('/', () => 'hello world')
    }])
  }

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: [{
        path: require.resolve('./fixtures/other-side.js')
      }]
    }
  }, myApp)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url))
  const body = await res.body.json()
  assert.strictEqual(res.statusCode, 500)
  assert.deepStrictEqual(body, {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'kaboom'
  })
})

test('accept packages', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      packages: [{
        name: '@fastify/compress',
        options: {
          threshold: 1 // 1 byte
        }
      }]
    }
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url, {
    headers: {
      'accept-encoding': 'gzip'
    }
  }))
  assert.strictEqual(res.statusCode, 200)
  let body = ''
  await pipeline(res.body, createGunzip(), async function * (stream) {
    stream.setEncoding('utf8')
    for await (const chunk of stream) {
      body += chunk
    }
  })
  assert.deepStrictEqual(JSON.parse(body), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})

test('accept packages / string form', async (t) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      packages: ['@fastify/compress']
    }
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  assert.match(app.printPlugins(), /@fastify\/compress/)
})

test('customize service without toLoad', async (t) => {
  async function myApp (app, opts) {
    await platformaticService(app, opts)
    app.get('/', () => 'hello world')
  }

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    }
  }, myApp)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url))
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

test('customize service with beforePlugins', async (t) => {
  async function myApp (app, opts) {
    await platformaticService(app, {
      ...opts,
      beforePlugins: [async function (app) {
        app.get('/', () => 'hello world')
      }] 
    })
  }

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    }
  }, myApp)

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url))
  const body = await res.body.text()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(body, 'hello world')
})

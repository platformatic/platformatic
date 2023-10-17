'use strict'

// setup the undici agent
require('./helper')

const assert = require('node:assert')
const { test } = require('node:test')
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

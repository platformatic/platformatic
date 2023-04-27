'use strict'

// setup the undici agent
require('./helper')

const { test } = require('tap')
const { buildServer, platformaticService } = require('..')
const { request } = require('undici')

test('customize service', async ({ teardown, equal }) => {
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

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(app.url))
  const body = await res.body.text()
  equal(res.statusCode, 200)
  equal(body, 'hello world')
})

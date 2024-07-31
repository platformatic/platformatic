'use strict'

const os = require('node:os')
const assert = require('assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')
const { writeFile } = require('node:fs/promises')
const { request, setGlobalDispatcher, getGlobalDispatcher, MockAgent } = require('undici')
const { buildServer } = require('..')

// set up the undici Agent
require('./helper')

test('error', async (t) => {
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
      port: 0,
    },
    plugins: {
      paths: [file],
    },
    watch: false,
    metrics: false,
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/`)
  assert.strictEqual(res.statusCode, 500, 'add status code')

  const data = await res.body.json()
  assert.strictEqual(data.message, 'kaboom')
})

test('mock undici is supported', async (t) => {
  const previousAgent = getGlobalDispatcher()
  t.after(() => setGlobalDispatcher(previousAgent))

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  const mockPool = mockAgent.get('http://localhost:42')

  // intercept the request
  mockPool.intercept({
    path: '/',
    method: 'GET',
  }).reply(200, {
    hello: 'world',
  })

  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'undici-plugin.js')],
    },
  })

  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await app.inject('/request')
  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'world',
  })
})

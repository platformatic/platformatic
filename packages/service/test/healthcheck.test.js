'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { request } = require('undici')
const { createStackableFromConfig } = require('./helper')

test('healthcheck route enabled with interval', async t => {
  let check = true
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: {
        interval: 2000,
        fn: function () {
          return check
        }
      }
    },
    metrics: false
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/status`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepStrictEqual(body, { status: 'ok' })
  }

  check = false

  {
    const res = await request(`${app.url}/status`)
    assert.strictEqual(res.statusCode, 503)
    const body = await res.body.json()
    assert.deepStrictEqual(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }

  check = true
})

test('healthcheck route enabled without interval', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: true
    },
    metrics: false
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/status`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepStrictEqual(body, { status: 'ok' })
  }
})

test('healthcheck route disabled', async t => {
  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    metrics: false
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/status`)
  assert.strictEqual(res.statusCode, 404)
})

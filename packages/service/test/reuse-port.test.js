'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')
const { features } = require('@platformatic/utils')

test('automatically apply reuse port if isProduction is in the context', { skip: !features.node.reusePort }, async (t) => {
  const app1 = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 8787,
    }
  }), null, {
    isProduction: true
  })

  const app2 = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 8787,
    }
  }), null, {
    isProduction: true
  })

  t.after(async () => {
    await app1.close()
    await app2.close()
  })

  await app1.start()
  await app2.start()

  const res = await (request(`${app1.url}/`))
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
})

'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { request } = require('undici')
const { buildConfig, createStackableFromConfig } = require('./helper')
const { features } = require('@platformatic/utils')

test(
  'automatically apply reuse port if isProduction is in the context',
  { skip: !features.node.reusePort },
  async t => {
    const app1 = await createStackableFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          port: 8787,
          logger: { level: 'fatal' }
        }
      }),
      null,
      {
        isProduction: true
      }
    )

    const app2 = await createStackableFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          port: 8787,
          logger: { level: 'fatal' }
        }
      }),
      null,
      {
        isProduction: true
      }
    )

    t.after(async () => {
      await app1.stop()
      await app2.stop()
    })

    await app1.start({ listen: true })
    await app2.start({ listen: true })

    const res = await request(`${app1.url}/`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }
)

'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { createFromConfig } = require('../helper')

test('inject request into service stackable', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    composer: {
      services: []
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const stackable = await createFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const { statusCode, body } = await stackable.inject('/custom')
  assert.strictEqual(statusCode, 200, 'status code')

  const data = JSON.parse(body)
  assert.deepStrictEqual(data, { hello: 'world' })
})

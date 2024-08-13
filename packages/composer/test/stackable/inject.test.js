'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

test('inject request into service stackable', async (t) => {
  const config = {
    composer: {
      services: [],
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')],
    },
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const { statusCode, body } = await stackable.inject('/custom')
  assert.strictEqual(statusCode, 200, 'status code')

  const data = JSON.parse(body)
  assert.deepStrictEqual(data, { hello: 'world' })
})

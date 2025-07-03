'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { create } = require('../..')

test('inject request into service stackable', async t => {
  const stackable = await create(join(__dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  {
    const { statusCode, body } = await stackable.inject('/')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from root' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/bar')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from bar' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/baz')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from baz' })
  }
})

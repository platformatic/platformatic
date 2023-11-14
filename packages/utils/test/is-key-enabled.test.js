'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { isKeyEnabled } = require('..')

test('isKeyEnabled', async (t) => {
  const a = {
    foo: true,
    bar: {
      hello: 'world'
    },
    baz: false
  }
  equal(isKeyEnabled('foo', a), true)
  equal(isKeyEnabled('bar', a), true)
  equal(isKeyEnabled('baz', a), false)
  equal(isKeyEnabled('nope', a), false)
  equal(isKeyEnabled('something', undefined), false)
})

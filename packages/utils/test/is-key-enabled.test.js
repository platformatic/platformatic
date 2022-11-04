'use strict'

const { test } = require('tap')
const { isKeyEnabled } = require('..')

test('isKeyEnabled', async (t) => {
  const a = {
    foo: true,
    bar: {
      hello: 'world'
    },
    baz: false
  }
  t.equal(isKeyEnabled('foo', a), true)
  t.equal(isKeyEnabled('bar', a), true)
  t.equal(isKeyEnabled('baz', a), false)
  t.equal(isKeyEnabled('nope', a), false)
})

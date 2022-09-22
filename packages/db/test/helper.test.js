'use strict'

const { test } = require('tap')
const { isKeyEnabledInConfig } = require('../lib/helper')

test('config key is enabled', ({ equal, plan }) => {
  plan(6)
  equal(isKeyEnabledInConfig('foo', { bar: 'baz' }), false) // key is undefined
  equal(isKeyEnabledInConfig('foo', { foo: false }), false)

  equal(isKeyEnabledInConfig('foo', { foo: 'baz' }), true)
  equal(isKeyEnabledInConfig('foo', { foo: {} }), true)
  equal(isKeyEnabledInConfig('foo', { foo: { bar: 'baz' } }), true)
  equal(isKeyEnabledInConfig('foo', { foo: true }), true)
})

'use strict'

const { test } = require('tap')
const { findNearestString } = require('..')

test('findNearestString - exact match', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  t.equal(findNearestString(strings, 'foo'), 'foo')
  t.equal(findNearestString(strings, 'bar'), 'bar')
  t.equal(findNearestString(strings, 'baz'), 'baz')
})

test('findNearestString - one character distance', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  t.equal(findNearestString(strings, 'fo'), 'foo')
  t.equal(findNearestString(strings, 'ba'), 'bar')
  t.equal(findNearestString(strings, 'bz'), 'baz')
})

test('findNearestString - two character distance', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  t.equal(findNearestString(strings, 'f'), 'foo')
  t.equal(findNearestString(strings, 'b'), 'bar')
  t.equal(findNearestString(strings, 'z'), 'baz')
})

test('findNearestString - different cases with long words', async (t) => {
  const strings = ['fooBarBaz', 'barBazFoo', 'bazFooBar']

  t.equal(findNearestString(strings, 'FooBarBaz'), 'fooBarBaz')
  t.equal(findNearestString(strings, 'BarBazFoo'), 'barBazFoo')
  t.equal(findNearestString(strings, 'BazFooBar'), 'bazFooBar')

  t.equal(findNearestString(strings, 'foo_bar_baz'), 'fooBarBaz')
  t.equal(findNearestString(strings, 'bar_baz_foo'), 'barBazFoo')
  t.equal(findNearestString(strings, 'baz_foo_bar'), 'bazFooBar')

  t.equal(findNearestString(strings, 'foo-bar-baz'), 'fooBarBaz')
  t.equal(findNearestString(strings, 'bar-baz-foo'), 'barBazFoo')
  t.equal(findNearestString(strings, 'baz-foo-bar'), 'bazFooBar')
})

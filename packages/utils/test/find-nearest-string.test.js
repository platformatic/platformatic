'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { findNearestString } = require('..')

test('findNearestString - exact match', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'foo'), 'foo')
  equal(findNearestString(strings, 'bar'), 'bar')
  equal(findNearestString(strings, 'baz'), 'baz')
})

test('findNearestString - one character distance', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'fo'), 'foo')
  equal(findNearestString(strings, 'ba'), 'bar')
  equal(findNearestString(strings, 'bz'), 'baz')
})

test('findNearestString - two character distance', async (t) => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'f'), 'foo')
  equal(findNearestString(strings, 'b'), 'bar')
  equal(findNearestString(strings, 'z'), 'baz')
})

test('findNearestString - different cases with long words', async (t) => {
  const strings = ['fooBarBaz', 'barBazFoo', 'bazFooBar']

  equal(findNearestString(strings, 'FooBarBaz'), 'fooBarBaz')
  equal(findNearestString(strings, 'BarBazFoo'), 'barBazFoo')
  equal(findNearestString(strings, 'BazFooBar'), 'bazFooBar')

  equal(findNearestString(strings, 'foo_bar_baz'), 'fooBarBaz')
  equal(findNearestString(strings, 'bar_baz_foo'), 'barBazFoo')
  equal(findNearestString(strings, 'baz_foo_bar'), 'bazFooBar')

  equal(findNearestString(strings, 'foo-bar-baz'), 'fooBarBaz')
  equal(findNearestString(strings, 'bar-baz-foo'), 'barBazFoo')
  equal(findNearestString(strings, 'baz-foo-bar'), 'bazFooBar')
})

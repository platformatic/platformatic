'use strict'

const { test } = require('tap')
const { deepmerge } = require('..')

test('deepmerge', async (t) => {
  const first = {
    b: [{
      a: 'foo'
    }]
  }
  const second = {
    b: [{
      b: 'bar'
    }]
  }
  const result = deepmerge(first, second)
  t.same(result, {
    b: [{
      a: 'foo',
      b: 'bar'
    }]
  })
})

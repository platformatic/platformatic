'use strict'

const { test } = require('node:test')
const { deepEqual } = require('node:assert')
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
  deepEqual(result, {
    b: [{
      a: 'foo',
      b: 'bar'
    }]
  })
})

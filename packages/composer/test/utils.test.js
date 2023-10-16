'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { prefixWithSlash } = require('../lib/utils')

test('should add slash if needed', async (t) => {
  const expectations = [
    { input: '', output: '/' },
    { input: '/foobar', output: '/foobar' },
    { input: undefined, output: '' },
    { input: null, output: '' }
  ]

  for (const exp of expectations) {
    assert.equal(prefixWithSlash(exp.input), exp.output)
  }
})

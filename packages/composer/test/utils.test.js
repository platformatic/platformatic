'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { prefixWithSlash, isFetchable } = require('../lib/utils')

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

test('isFetchable unit test', t => {
  const cases = [
    { label: 'empty service', params: {}, expected: false },
    { label: 'openapi service from file', params: { openapi: { file: '/to/file' } }, expected: false },
    { label: 'openapi+graphql service, openapi has url', params: { openapi: { url: 'http://service/opeanapi' }, graphql: true }, expected: true },
    { label: 'openapi+graphql service with default', params: { graphql: true, openapi: true }, expected: true }
  ]

  for (const c of cases) {
    assert.equal(isFetchable(c.params), c.expected, c.label)
  }
})

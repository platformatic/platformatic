import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFetchable, prefixWithSlash } from '../lib/utils.js'

test('should add slash if needed', async t => {
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
    { label: 'empty application', params: {}, expected: false },
    { label: 'openapi application from file', params: { openapi: { file: '/to/file' } }, expected: false },
    { label: 'openapi application with url', params: { openapi: { url: 'http://application/opeanapi' } }, expected: true },
    { label: 'openapi application with default', params: { openapi: true }, expected: false }
  ]

  for (const c of cases) {
    assert.equal(isFetchable(c.params), c.expected, c.label)
  }
})

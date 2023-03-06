'use strict'

const { test } = require('tap')
const { analyze } = require('..')

test('throws if no config or file is provided', async (t) => {
  await t.rejects(analyze({}), new Error('missing file or config to analyze'))
})

test('throws if no $schema is set', async (t) => {
  await t.rejects(analyze({ config: {} }), new Error('missing $schema, unable to determine the version'))
})

test('throws if $schema is not a matching URL', async (t) => {
  await t.rejects(analyze({ config: { $schema: 'https://foo' } }), new Error('unable to determine the version'))
})

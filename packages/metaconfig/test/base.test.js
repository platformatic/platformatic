'use strict'

const { test } = require('tap')
const { analyze } = require('..')
const ZeroSeventeen = require('../versions/0.17.x.js')

test('throws if no config or file is provided', async (t) => {
  await t.rejects(analyze({}), new Error('missing file or config to analyze'))
})

test('throws if no $schema is set', async (t) => {
  await t.rejects(analyze({ config: {} }), new Error('missing $schema, unable to determine the version'))
})

test('throws if $schema is not a matching URL', async (t) => {
  await t.rejects(analyze({ config: { $schema: 'https://foo' } }), new Error('unable to determine the version'))
})

test('loads the previous semver minor for a patch release', async (t) => {
  const meta = await analyze({ config: { $schema: 'https://platformatic.dev/schemas/v0.17.1/db' } })
  t.type(meta, ZeroSeventeen)
})

test('throws if version is unknown', async (t) => {
  await t.rejects(analyze({ config: { $schema: 'https://platformatic.dev/schemas/v0.2.0/db' } }), new Error('unable to determine the version'))
})

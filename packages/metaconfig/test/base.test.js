'use strict'

const { test } = require('tap')
const { analyze, getParser, getStringifier, write } = require('..')
const ZeroSeventeen = require('../versions/0.17.x.js')
const YAML = require('yaml')
const TOML = require('@iarna/toml')
const JSON5 = require('json5')
const { tmpdir } = require('os')
const { join } = require('path')
const { cp } = require('fs/promises')

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

test('gets the parser for a given format', async (t) => {
  t.equal(getParser('file.json'), JSON.parse)
  t.equal(getParser('file.yaml'), YAML.parse)
  t.equal(getParser('file.yml'), YAML.parse)
  t.equal(getParser('file.toml'), TOML.parse)
  t.equal(getParser('file.json5'), JSON5.parse)
})

test('gets the stringify for a given format', async (t) => {
  t.equal(getStringifier('file.yaml'), YAML.stringify)
  t.equal(getStringifier('file.yml'), YAML.stringify)
  t.equal(getStringifier('file.toml'), TOML.stringify)

  {
    const stringify = getStringifier('file.json')
    t.equal(stringify({ foo: 'bar' }), JSON.stringify({ foo: 'bar' }, null, 2))
  }

  {
    const stringify = getStringifier('file.json5')
    t.equal(stringify({ foo: 'bar' }), JSON5.stringify({ foo: 'bar' }, null, 2))
  }
})

test('throws if the stringifier is unknown', async (t) => {
  t.throws(() => { getStringifier('file.foo') }, new Error('Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.'))
})

test('throws if the parser is unknown', async (t) => {
  t.throws(() => { getParser('file.foo') }, new Error('Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.'))
})

test('writes a config file', async (t) => {
  const dest = join(tmpdir(), `test-metaconfig-${process.pid}.json`)
  await cp(join(__dirname, 'fixtures', 'v0.16.0', 'array.db.json'), dest)
  const meta = await analyze({ file: dest })
  meta.format = 'yaml' // transform to yaml
  meta.path = dest.replace(/\.json$/, '.yaml')
  await write(meta)

  const meta2 = await analyze({ file: meta.path })
  t.equal(meta2.format, 'yaml')
  t.equal(meta2.path, meta.path)
  t.same(meta2.config, meta.config)
})

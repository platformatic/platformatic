'use strict'

const { test } = require('node:test')
const { equal, deepEqual, throws, rejects, ok } = require('node:assert')
const { analyze, getParser, getStringifier, write, upgrade } = require('..')
const ZeroSeventeen = require('../versions/0.17.x.js')
const YAML = require('yaml')
const TOML = require('@iarna/toml')
const JSON5 = require('json5')
const { tmpdir } = require('os')
const { join } = require('path')
const { cp } = require('fs/promises')
const pkg = require('../package.json')
const semver = require('semver')
const createError = require('@fastify/error')

test('throws if no config or file is provided', async () => {
  await rejects(analyze({}), {
    message: 'missing file or config to analyze'
  })
})

test('throws if no $schema is set', async () => {
  await rejects(analyze({ config: {} }), {
    message: 'missing $schema, unable to determine the version'
  })
})

test('throws if $schema is not a matching URL', async () => {
  await rejects(analyze({ config: { $schema: 'https://foo' } }), {
    message: 'unable to determine the version'
  })
})

test('loads the previous semver minor for a patch release', async () => {
  const meta = await analyze({ config: { $schema: 'https://platformatic.dev/schemas/v0.17.1/db' } })
  ok(meta instanceof ZeroSeventeen)
  equal(meta.version, '0.17.1')
})

test('throws if version is unknown', async () => {
  await rejects(analyze({ config: { $schema: 'https://platformatic.dev/schemas/v0.2.0/db' } }), {
    message: 'unable to determine the version'
  })
})

test('gets the parser for a given format', async () => {
  equal(getParser('file.json'), JSON.parse)
  equal(getParser('file.yaml'), YAML.parse)
  equal(getParser('file.yml'), YAML.parse)
  equal(getParser('file.toml'), TOML.parse)
  equal(getParser('file.json5'), JSON5.parse)
})

test('gets the stringify for a given format', async () => {
  equal(getStringifier('file.yaml'), YAML.stringify)
  equal(getStringifier('file.yml'), YAML.stringify)
  equal(getStringifier('file.toml'), TOML.stringify)

  {
    const stringify = getStringifier('file.json')
    equal(stringify({ foo: 'bar' }), JSON.stringify({ foo: 'bar' }, null, 2))
  }

  {
    const stringify = getStringifier('file.json5')
    equal(stringify({ foo: 'bar' }), JSON5.stringify({ foo: 'bar' }, null, 2))
  }
})

test('throws if the stringifier is unknown', async () => {
  const expectedError = new (createError('PLT_SQL_METACONFIG_INVALID_CONFIG_FILE_EXTENSION', 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.'))()
  throws(() => { getStringifier('file.foo') }, expectedError)
})

test('throws if the parser is unknown', async () => {
  const expectedError = new (createError('PLT_SQL_METACONFIG_INVALID_CONFIG_FILE_EXTENSION', 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.'))()
  throws(() => { getParser('file.foo') }, expectedError)
})

test('writes a config file', async () => {
  const dest = join(tmpdir(), `test-metaconfig-${process.pid}.json`)
  await cp(join(__dirname, 'fixtures', 'v0.16.0', 'array.db.json'), dest)
  const meta = await analyze({ file: dest })
  meta.format = 'yaml' // transform to yaml
  meta.path = dest.replace(/\.json$/, '.yaml')
  await write(meta)

  const meta2 = await analyze({ file: meta.path })
  equal(meta2.format, 'yaml')
  equal(meta2.path, meta.path)
  deepEqual(meta2.config, meta.config)
})

test('current version must be matched', async () => {
  const version = pkg.version.replace('-dev', '')
  const meta = await analyze({ config: { $schema: `https://platformatic.dev/schemas/v${version}/db` } })
  equal(meta.version, version)
})

test('upgrade to latest version', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'array.db.json')
  const meta = await analyze({ file })
  const upgraded = upgrade(meta)
  const version = pkg.version.replace('-dev', '')
  console.log(`upgraded to ${upgraded.version}`)
  equal(semver.satisfies(version, '^' + upgraded.version), true)
})

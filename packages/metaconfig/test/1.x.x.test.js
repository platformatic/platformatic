'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const semver = require('semver')
const OneXX = require('../versions/1.x.x')
const pkg = require('../package.json')
const proxyquire = require('proxyquire')

test('specified version is bigger than the current version (minor)', async () => {
  const version = semver.inc(pkg.version, 'minor')
  const meta = new OneXX({ version, config: {} })
  equal(meta.up, undefined)
})

test('specified version is bigger than the current version (major)', async () => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new OneXX({ version, config: {} })
  equal(meta.up, undefined)
})

test('upgrade minor versions', async () => {
  const OneXX = proxyquire('../versions/1.x.x.js', {
    '../package.json': {
      version: '1.1.0'
    }
  })
  const version = '1.0.1'
  const meta = new OneXX({ version, config: { } })
  const upped = meta.up()

  equal(upped.version, '1.1.0')
})

test('upgrade patch versions', async () => {
  const OneXX = proxyquire('../versions/1.x.x.js', {
    '../package.json': {
      version: '1.0.2'
    }
  })
  const version = '1.0.1'
  const meta = new OneXX({ version, config: { } })
  const upped = meta.up()
  equal(upped.version, '1.0.2')
})

test('deletes watch', async () => {
  const OneXX = proxyquire('../versions/1.x.x.js', {
    '../package.json': {
      version: '1.1.0'
    }
  })
  const version = '1.0.1'
  const meta = new OneXX({ version, config: { watch: true, entrypoint: 'foo' } })
  const upped = meta.up()
  equal(upped.version, '1.1.0')

  equal(upped.config.watch, undefined)
})

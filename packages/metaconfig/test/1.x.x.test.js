'use strict'

const { test } = require('tap')
const semver = require('semver')
const OneXX = require('../versions/1.x.x')
const pkg = require('../package.json')
const proxyquire = require('proxyquire')

test('specified version is bigger than the current version (minor)', async (t) => {
  const version = semver.inc(pkg.version, 'minor')
  const meta = new OneXX({ version, config: {} })
  t.equal(meta.up, undefined)
})

test('specified version is bigger than the current version (major)', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new OneXX({ version, config: {} })
  t.equal(meta.up, undefined)
})

test('upgrade minor versions', async (t) => {
  const OneXX = proxyquire('../versions/1.x.x.js', {
    '../package.json': {
      version: '1.1.0'
    }
  })
  const version = '1.0.1'
  const meta = new OneXX({ version, config: { } })
  const upped = meta.up()
  t.match(upped, {
    version: '1.1.0'
  })
})

test('upgrade patch versions', async (t) => {
  const OneXX = proxyquire('../versions/1.x.x.js', {
    '../package.json': {
      version: '1.0.2'
    }
  })
  const version = '1.0.1'
  const meta = new OneXX({ version, config: { } })
  const upped = meta.up()
  t.match(upped, {
    version: '1.0.2'
  })
})

'use strict'

const { test } = require('tap')
const semver = require('semver')
const FromZeroEighteenToWillSee = require('../versions/from-zero-eighteen-to-will-see')
const pkg = require('../package.json')

test('specified version is bigger than the current version (minor)', async (t) => {
  const version = semver.inc(pkg.version, 'minor')
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  t.equal(meta.up, undefined)
})

test('specified version is bigger than the current version (major)', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  t.equal(meta.up, undefined)
})

'use strict'

const { test } = require('node:test')
const { equal, deepEqual, notDeepEqual, ok } = require('node:assert')
const semver = require('semver')
const FromZeroEighteenToWillSee = require('../versions/from-zero-eighteen-to-will-see')
const pkg = require('../package.json')
const proxyquire = require('proxyquire')

test('specified version is bigger than the current version (minor)', async (t) => {
  const version = semver.inc(pkg.version, 'minor')
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  equal(meta.up, undefined)
})

test('specified version is bigger than the current version (major)', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  equal(meta.up, undefined)
})

test('handles composer apps', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({
    version,
    config: { composer: {} }
  })
  equal(meta.kind, 'composer')
})

test('handles runtime apps', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({
    version,
    config: { entrypoint: 'foo' }
  })
  equal(meta.kind, 'runtime')
})

test('adds watch.ignore if watch is undefined', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  const upped = meta.up()
  deepEqual(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('adds watch.ignore if watch is an object', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: {} } })
  const upped = meta.up()
  deepEqual(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('does not add watch.ignore if watch.ignore is an array', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: { ignore: [] } } })
  const upped = meta.up()
  deepEqual(upped.config.watch, {
    ignore: []
  })
})

test('adds watch.ignore if watch is true', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: true } })
  const upped = meta.up()
  deepEqual(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('does not add watch if it is set to false', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: false } })
  const upped = meta.up()
  equal(upped.config.watch, false)
})

test('removes plugins.hotReload if it exists', async (t) => {
  const version = '0.26.0'

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: { hotReload: true } }
    })
    equal('hotReload' in meta.config.plugins, true)
    const upped = meta.up()
    equal('hotReload' in upped.config.plugins, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: { hotReload: false } }
    })
    equal('hotReload' in meta.config.plugins, true)
    const upped = meta.up()
    equal('hotReload' in upped.config.plugins, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: {} }
    })
    equal('hotReload' in meta.config.plugins, false)
    const upped = meta.up()
    equal('hotReload' in upped.config.plugins, false)
  }
})

test('removes db.dashboard if it exists', async (t) => {
  const version = '0.40.0'

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: { dashboard: true } }
    })
    equal('dashboard' in meta.config.db, true)
    const upped = meta.up()
    equal('dashboard' in upped.config.db, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: { dashboard: false } }
    })
    equal('dashboard' in meta.config.db, true)
    const upped = meta.up()
    equal('dashboard' in upped.config.db, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: {} }
    })
    equal('dashboard' in meta.config.db, false)
    const upped = meta.up()
    equal('dashboard' in upped.config.db, false)
  }
})

test('upgrade patch versions', async (t) => {
  const FromZeroEighteenToWillSee = proxyquire('../versions/from-zero-eighteen-to-will-see', {
    '../package.json': {
      version: '0.33.1'
    }
  })
  const version = '0.33.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { } })
  const upped = meta.up()
  equal(upped.version, '0.33.1')
})

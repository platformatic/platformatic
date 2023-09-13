'use strict'

const { test } = require('tap')
const semver = require('semver')
const FromZeroEighteenToWillSee = require('../versions/from-zero-eighteen-to-will-see')
const pkg = require('../package.json')
const proxyquire = require('proxyquire')

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

test('handles composer apps', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({
    version,
    config: { composer: {} }
  })
  t.equal(meta.kind, 'composer')
})

test('handles runtime apps', async (t) => {
  const version = semver.inc(pkg.version, 'major')
  const meta = new FromZeroEighteenToWillSee({
    version,
    config: { entrypoint: 'foo' }
  })
  t.equal(meta.kind, 'runtime')
})

test('adds watch.ignore if watch is undefined', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: {} })
  const upped = meta.up()
  t.same(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('adds watch.ignore if watch is an object', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: {} } })
  const upped = meta.up()
  t.same(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('does not add watch.ignore if watch.ignore is an array', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: { ignore: [] } } })
  const upped = meta.up()
  t.same(upped.config.watch, {
    ignore: []
  })
})

test('adds watch.ignore if watch is true', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: true } })
  const upped = meta.up()
  t.same(upped.config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})

test('does not add watch if it is set to false', async (t) => {
  const version = '0.26.0'
  const meta = new FromZeroEighteenToWillSee({ version, config: { watch: false } })
  const upped = meta.up()
  t.equal(upped.config.watch, false)
})

test('removes plugins.hotReload if it exists', async (t) => {
  const version = '0.26.0'

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: { hotReload: true } }
    })
    t.equal('hotReload' in meta.config.plugins, true)
    const upped = meta.up()
    t.equal('hotReload' in upped.config.plugins, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: { hotReload: false } }
    })
    t.equal('hotReload' in meta.config.plugins, true)
    const upped = meta.up()
    t.equal('hotReload' in upped.config.plugins, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { plugins: {} }
    })
    t.equal('hotReload' in meta.config.plugins, false)
    const upped = meta.up()
    t.equal('hotReload' in upped.config.plugins, false)
  }
})

test('removes db.dashboard if it exists', async (t) => {
  const version = '0.40.0'

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: { dashboard: true } }
    })
    t.equal('dashboard' in meta.config.db, true)
    const upped = meta.up()
    t.equal('dashboard' in upped.config.db, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: { dashboard: false } }
    })
    t.equal('dashboard' in meta.config.db, true)
    const upped = meta.up()
    t.equal('dashboard' in upped.config.db, false)
  }

  {
    const meta = new FromZeroEighteenToWillSee({
      version,
      config: { db: {} }
    })
    t.equal('dashboard' in meta.config.db, false)
    const upped = meta.up()
    t.equal('dashboard' in upped.config.db, false)
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
  t.match(upped, {
    version: '0.33.1'
  })
})

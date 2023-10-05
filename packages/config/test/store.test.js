'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { Store } = require('../')
const { ConfigManager } = require('../lib/manager')

test('Store with builtins', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  try {
    await store.get({ $schema: 'bar' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Add a module property to the config or add a known $schema.')
  }
  try {
    await store.get({ $schema: 'https://platformatic.dev/schemas/v0.99.0/something.json' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Version mismatch. You are running Platformatic null but your app requires v0.99.0')
  }
  assert.deepEqual(store.listTypes(), [{
    id: 'foo',
    configType: 'foo'
  }])
})

test('missing schema', async t => {
  function foo () {
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {}

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('missing configType', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('no configManagerConfig', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'foo'

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  try {
    await store.get({ $schema: 'bar' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Add a module property to the config or add a known $schema.')
  }
})

test('add schema to configManagerConfig', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  try {
    await store.get({ $schema: 'bar' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Add a module property to the config or add a known $schema.')
  }
  assert.equal((await store.get({ $schema: 'foo' })).configManagerConfig.schema, foo.schema, 'should have schema')
})

test('schema with no id', async t => {
  function foo () {
  }

  foo.schema = {}
  foo.configType = 'foo'
  foo.configManagerConfig = {}

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('resolve with module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  assert.equal(await store.get({
    $schema: 'http://something/foo',
    module: 'foo'
  }), require('./fixtures/app/node_modules/foo'), 'should resolve module')
})

test('resolve with extends', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  assert.equal(await store.get({
    $schema: 'http://something/foo',
    extends: 'foo'
  }), require('./fixtures/app/node_modules/foo'), 'should resolve module')
})

test('rejects with missing extended module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  try {
    await store.get({ $schema: 'http://something/foo', extends: 'baz' })
    assert.fail()
  } catch (err) {}
})

test('import', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  assert.equal(await store.get({
    $schema: 'http://something/foo',
    extends: 'foom'
  }), (await import('./fixtures/app/node_modules/foom/foo.js')).default, 'should resolve module')
})

test('app must be a function', async t => {
  const foo = {}

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('loadConfig', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'service'
  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures'))

  const store = new Store()
  store.add(foo)

  t.after(() => {
    process.chdir(cwd)
  })

  const res = await store.loadConfig()
  assert.equal(res.configManager instanceof ConfigManager, true, 'should return configManager')
  assert.equal(res.app, foo, 'should return app')
})

test('loadConfig', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'foo',
    type: 'object'
  }

  foo.configType = 'service'
  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures'))

  const store = new Store()
  store.add(foo)

  t.after(() => {
    process.chdir(cwd)
  })

  const res = await store.loadConfig()
  assert.equal(res.configManager instanceof ConfigManager, true, 'should return configManager')
  assert.equal(res.app, foo, 'should return app')
})

test('loadConfig custom module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  const res = await store.loadConfig()
  assert.equal(res.app.schema.$id, 'foo', 'should return app')
})

test('Version mismatch', async t => {
  function foo () {
  }

  foo.schema = {
    $id: 'https://platformatic.dev/schemas/v0.42.0/something.json',
    type: 'object'
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    envWhitelist: ['PORT', 'HOSTNAME'],
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig () {
    }
  }

  const store = new Store()
  store.add(foo)

  try {
    await store.get({ $schema: 'https://platformatic.dev/schemas/v0.99.0/something.json' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Version mismatch. You are running Platformatic v0.42.0 but your app requires v0.99.0')
  }
})

'use strict'

const { test } = require('tap')
const { Store } = require('../')
const { join } = require('path')
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

  t.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  await t.rejects(store.get({ $schema: 'bar' }), new Error('Add a module property to the config or add a known $schema'))
  await t.rejects(store.get({ $schema: 'https://platformatic.dev/schemas/v0.99.0/something.json' }), new Error('Version mismatch. You are running Platformatic null but your app requires v0.99.0'))
  t.same(store.listTypes(), [{
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
  t.throws(store.add.bind(store, foo))
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
  t.throws(store.add.bind(store, foo))
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

  t.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  await t.rejects(store.get({ $schema: 'bar' }))
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

  t.equal(await store.get({ $schema: 'foo' }), foo, 'should have builtin value')
  await t.rejects(store.get({ $schema: 'bar' }))
  t.equal((await store.get({ $schema: 'foo' })).configManagerConfig.schema, foo.schema, 'should have schema')
})

test('schema with no id', async t => {
  function foo () {
  }

  foo.schema = {}
  foo.configType = 'foo'
  foo.configManagerConfig = {}

  const store = new Store()
  t.throws(store.add.bind(store, foo))
})

test('resolve', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  t.equal(await store.get({
    $schema: 'http://something/foo',
    module: 'foo'
  }), require('./fixtures/app/node_modules/foo'), 'should resolve module')
})

test('rejects with missing module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  await t.rejects(store.get({
    $schema: 'http://something/foo',
    module: 'baz'
  }))
})

test('import', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  t.equal(await store.get({
    $schema: 'http://something/foo',
    module: 'foom'
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
  t.throws(store.add.bind(store, foo))
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

  t.teardown(() => {
    process.chdir(cwd)
  })

  const res = await store.loadConfig()
  t.equal(res.configManager instanceof ConfigManager, true, 'should return configManager')
  t.equal(res.app, foo, 'should return app')
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

  t.teardown(() => {
    process.chdir(cwd)
  })

  const res = await store.loadConfig()
  t.equal(res.configManager instanceof ConfigManager, true, 'should return configManager')
  t.equal(res.app, foo, 'should return app')
})

test('loadConfig custom module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app')
  })

  const res = await store.loadConfig()
  t.equal(res.app.schema.$id, 'foo', 'should return app')
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

  await t.rejects(store.get({ $schema: 'https://platformatic.dev/schemas/v0.99.0/something.json' }), new Error('Version mismatch. You are running Platformatic v0.42.0 but your app requires v0.99.0'))
})

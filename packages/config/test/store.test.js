'use strict'

const { test } = require('tap')
const { Store } = require('../')
const { join } = require('path')

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
  await t.rejects(store.get({ $schema: 'bar' }))
  t.same(store.listConfigFiles(), ['platformatic.foo.json'])
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
    cwd: join(__dirname, 'fixtures', 'app', 'index.js')
  })

  t.equal(await store.get({
    $schema: 'http://something/foo',
    module: 'foo'
  }), require('./fixtures/app/node_modules/foo'), 'should resolve module')
})

test('rejects with missing module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app', 'index.js')
  })

  await t.rejects(store.get({
    $schema: 'http://something/foo',
    module: 'baz'
  }))
})

test('import', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app', 'index.js')
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

'use strict'

const assert = require('node:assert/strict')
const { mkdtemp, writeFile } = require('node:fs/promises')
const os = require('node:os')
const { test, describe } = require('node:test')
const { join } = require('node:path')
const { Store } = require('../')
const { ConfigManager } = require('../lib/manager')

const { version } = require('../package.json')
const { createDirectory, safeRemove } = require('@platformatic/utils')

const tmpdir = os.tmpdir()

test('Store with builtins', async t => {
  function foo () {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
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
    await store.get({ $schema: 'https://schemas.platformatic.dev/something/0.99.0.json' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Add a module property to the config or add a known $schema.')
  }
  assert.deepEqual(store.listTypes(), [
    {
      id: 'foo',
      configType: 'foo',
    },
  ])
})

test('missing schema', async t => {
  function foo () {}

  foo.configType = 'foo'
  foo.configManagerConfig = {}

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('missing configType', async t => {
  function foo () {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
  }

  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('no configManagerConfig', async t => {
  function foo () {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
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

test('schema with no id', async t => {
  function foo () {}

  foo.schema = {}
  foo.configType = 'foo'
  foo.configManagerConfig = {}

  const store = new Store()
  assert.throws(store.add.bind(store, foo))
})

test('resolve with module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app'),
  })

  assert.equal(
    await store.get({
      $schema: 'http://something/foo',
      module: 'foo',
    }),
    require('./fixtures/app/node_modules/foo'),
    'should resolve module'
  )
})

test('resolve with extends', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app'),
  })

  assert.equal(
    await store.get({
      $schema: 'http://something/foo',
      extends: 'foo',
    }),
    require('./fixtures/app/node_modules/foo'),
    'should resolve module'
  )
})

test('rejects with missing extended module', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app'),
  })

  try {
    await store.get({ $schema: 'http://something/foo', extends: 'baz' })
    assert.fail()
  } catch (err) {}
})

test('import', async t => {
  const store = new Store({
    cwd: join(__dirname, 'fixtures', 'app'),
  })

  assert.equal(
    await store.get({
      $schema: 'http://something/foo',
      extends: 'foom',
    }),
    (await import('./fixtures/app/node_modules/foom/foo.js')).default,
    'should resolve module'
  )
})

test('app can be an object', async t => {
  const foo = {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  assert.doesNotThrow(store.add.bind(store, foo))
})

test('loadConfig', async t => {
  function foo () {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
  }

  foo.configType = 'service'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
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
  function foo () {}

  foo.schema = {
    $id: 'foo',
    type: 'object',
  }

  foo.configType = 'service'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
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
    cwd: join(__dirname, 'fixtures', 'app'),
  })

  const res = await store.loadConfig()
  assert.equal(res.app.schema.$id, 'foo', 'should return app')
})

test('Version mismatch', async t => {
  function foo () {}

  foo.schema = {
    $id: 'https://schemas.platformatic.dev/something/0.42.0.json',
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  store.add(foo)

  try {
    await store.get({ $schema: 'https://schemas.platformatic.dev/something/0.99.0.json' })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Add a module property to the config or add a known $schema.')
  }
})

test('schema null', async t => {
  const store = new Store()
  assert.equal(store.getVersionFromSchema(undefined), null)
  assert.equal(store.getVersionFromSchema(null), null)
})

test('Platformatic Service with legacy schema', async t => {
  function foo () {}

  foo.schema = {
    $id: `https://platformatic.dev/schemas/v${version}/service`,
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: './foo' }), foo, 'should have builtin value')
})

test('Platformatic Service', async t => {
  function foo () {}

  foo.schema = {
    $id: `https://schemas.platformatic.dev/@platformatic/service/${version}.json`,
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: './foo' }), foo, 'should have builtin value')
})

test('Platformatic DB', async t => {
  function foo () {}

  foo.schema = {
    $id: `https://schemas.platformatic.dev/@platformatic/db/${version}.json`,
    type: 'object',
  }

  foo.configType = 'foo'
  foo.configManagerConfig = {
    schema: foo.schema,
    allowToWatch: ['.env'],
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false,
    },
    transformConfig () {},
  }

  const store = new Store()
  store.add(foo)

  assert.equal(await store.get({ $schema: './foo', db: {} }), foo, 'should have builtin value')
})

describe('default modules', () => {
  for (const type of ['service', 'db', 'composer']) {
    test(`automatically load ${type}`, async t => {
      const oldCwd = process.cwd()
      process.chdir(tmpdir)
      const cwd = join(tmpdir, await mkdtemp('store-'))
      process.chdir(cwd)
      t.after(async () => {
        process.chdir(oldCwd)
        await safeRemove(cwd)
      })

      await createDirectory(join(cwd, 'node_modules', '@platformatic', type))

      function foo () {}

      foo.schema = {
        $id: `https://schemas.platformatic.dev/@platformatic/${type}/${version}.json`,
        type: 'object',
      }

      foo.configType = type
      foo.configManagerConfig = {
        schema: foo.schema,
        allowToWatch: ['.env'],
        schemaOptions: {
          useDefaults: true,
          coerceTypes: true,
          allErrors: true,
          strict: false,
        },
      }

      await writeFile(
        join(cwd, 'node_modules', '@platformatic', type, 'index.js'),
        `
        function foo () {}
        foo.schema = ${JSON.stringify(foo.schema)}
        foo.configType = '${type}'
        foo.configManagerConfig = ${JSON.stringify(foo.configManagerConfig)}
        module.exports = foo
      `
      )

      const store = new Store({ cwd })

      const loaded = await store.get({
        $schema: `https://schemas.platformatic.dev/@platformatic/${type}/${version}.json`,
      })
      assert.deepEqual(loaded.schema, foo.schema, 'should have matching schema')
      assert.equal(loaded.configType, foo.configType, 'should have matching configType')
      assert.deepEqual(loaded.configManagerConfig, foo.configManagerConfig, 'should have matching configManagerConfig')

      assert.deepEqual(store.listTypes(), [
        {
          id: `https://schemas.platformatic.dev/@platformatic/${type}/${version}.json`,
          configType: type,
        },
      ])
    })
  }
})

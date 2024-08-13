'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { loadConfig, loadEmptyConfig, Store, printConfigValidationErrors, printAndExitLoadConfigError } = require('../')

function app () {}
app.configType = 'service'
app.schema = {
  $id: 'service',
  type: 'object',
}

test('happy path', async t => {
  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  const res = await loadConfig({}, ['-c', file, '--boo'], app)
  const { configManager, args } = res

  assert.equal(res.app, app)
  assert.equal(res.configType, app.configType)
  assert.deepEqual(args, {
    _: [],
    c: file,
    config: file,
    boo: true,
  })
  assert.deepEqual(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('cwd', async t => {
  {
    const cwd = process.cwd()
    process.chdir(join(__dirname, 'fixtures'))
    t.after(() => {
      process.chdir(cwd)
    })
  }
  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  const { configManager, args } = await loadConfig({}, [], app)

  assert.deepEqual(args, {
    _: [],
  })
  assert.deepEqual(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('empty rejects with an error', async t => {
  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures', 'empty'))
  t.after(() => {
    process.chdir(cwd)
  })

  try {
    await loadConfig({}, [], app)
  } catch (err) {
    assert.equal(err.message, 'no config file found')
    assert.deepEqual(err.filenames, [
      'platformatic.service.json',
      'platformatic.service.json5',
      'platformatic.service.yaml',
      'platformatic.service.yml',
      'platformatic.service.toml',
      'platformatic.service.tml',
      'platformatic.db.json',
      'platformatic.db.json5',
      'platformatic.db.yaml',
      'platformatic.db.yml',
      'platformatic.db.toml',
      'platformatic.db.tml',
      'platformatic.composer.json',
      'platformatic.composer.json5',
      'platformatic.composer.yaml',
      'platformatic.composer.yml',
      'platformatic.composer.toml',
      'platformatic.composer.tml',
      'platformatic.application.json',
      'platformatic.application.json5',
      'platformatic.application.yaml',
      'platformatic.application.yml',
      'platformatic.application.toml',
      'platformatic.application.tml',
      'platformatic.json',
      'platformatic.json5',
      'platformatic.yaml',
      'platformatic.yml',
      'platformatic.toml',
      'platformatic.tml',
    ])
  }
})

test('not passing validation kills the process', async t => {
  function app () {}
  app.configType = 'service'
  app.schema = {
    $id: 'service',
    type: 'object',
    properties: {
      foo: {
        type: 'string',
      },
    },
    required: ['foo'],
  }

  app.configManagerConfig = {
    schema: app.schema,
  }

  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  try {
    await loadConfig({}, ['-c', file, '--boo'], app)
  } catch (err) {
    assert.equal(err.message, 'The configuration does not validate against the configuration schema')
    assert.deepEqual(err.validationErrors, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      },
    ])
  }
})

test('loadConfig with Store', async t => {
  const file = join(__dirname, 'fixtures', 'with-store.json')

  const store = new Store()
  store.add(app)
  const { configManager, args } = await loadConfig({}, ['-c', file, '--boo'], store)

  assert.deepEqual(args, {
    _: [],
    c: file,
    config: file,
    boo: true,
  })
  assert.deepEqual(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('loadEmptyConfig', async t => {
  const { configManager, args } = await loadEmptyConfig(join(__dirname, 'fixtures'), app)

  assert.deepEqual(args, {})
  assert.deepEqual(configManager.current, {})
})

test('printConfigValidationErrors', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      },
    ])
  }
  t.after(() => {
    console.table = table
  })
  printConfigValidationErrors({
    validationErrors: [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
        foo: 'bar', // should be ignored
      },
    ],
  })
})

test('printAndExitLoadConfigError', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      },
    ])
  }
  t.after(() => {
    console.table = table
  })
  printConfigValidationErrors({
    validationErrors: [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
        foo: 'bar', // should be ignored
      },
    ],
  })
})

test('printAndExitLoadConfigError validationErrors', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      },
    ])
  }
  const processExit = process.exit
  process.exit = code => {
    assert.equal(code, 1)
  }
  t.after(() => {
    console.table = table
    process.exit = processExit
  })
  printAndExitLoadConfigError({
    validationErrors: [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}',
        foo: 'bar', // should be ignored
      },
    ],
  })
})

test('printAndExitLoadConfigError filenames', async t => {
  const error = console.error
  console.error = data => {
    assert.equal(
      data,
      `Missing config file!
Be sure to have a config file with one of the following names:

 * foo
 * bar

In alternative run "npm create platformatic@latest" to generate a basic platformatic service config.`
    )
  }
  const processExit = process.exit
  process.exit = code => {
    assert.equal(code, 1)
  }
  t.after(() => {
    console.error = error
    process.exit = processExit
  })
  printAndExitLoadConfigError({
    filenames: ['foo', 'bar'],
  })
})

test('printAndExitLoadConfigError bare error', async t => {
  const throwed = new Error('foo')
  const error = console.error
  console.error = data => {
    assert.equal(data, throwed)
  }
  const processExit = process.exit
  process.exit = code => {
    assert.equal(code, 1)
  }
  t.after(() => {
    console.error = error
    process.exit = processExit
  })
  printAndExitLoadConfigError(throwed)
})

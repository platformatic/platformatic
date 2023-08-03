'use strict'

const { test } = require('tap')
const { loadConfig, Store, printConfigValidationErrors, printAndExitLoadConfigError } = require('../')
const { join } = require('path')
const { readFile } = require('fs/promises')

function app () {
}
app.configType = 'service'
app.schema = {
  $id: 'service',
  type: 'object'
}

test('happy path', async t => {
  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  const { configManager, args } = await loadConfig({}, ['-c', file, '--boo'], app)

  t.same(args, {
    _: [],
    c: file,
    config: file,
    boo: true,
    allowEnv: '',
    'allow-env': '',
    E: ''
  })
  t.same(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('cwd', async t => {
  {
    const cwd = process.cwd()
    process.chdir(join(__dirname, 'fixtures'))
    t.teardown(() => {
      process.chdir(cwd)
    })
  }
  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  const { configManager, args } = await loadConfig({}, [], app)

  t.match(args, {
    _: [],
    allowEnv: '',
    'allow-env': '',
    E: ''
  })
  t.same(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('empty rejects with an error', async t => {
  t.plan(2)
  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures', 'empty'))
  t.teardown(() => {
    process.chdir(cwd)
  })

  try {
    await loadConfig({}, [], app)
  } catch (err) {
    t.equal(err.message, 'no config file found')
    t.same(err.filenames, [
      'platformatic.service.json',
      'platformatic.service.json5',
      'platformatic.service.yaml',
      'platformatic.service.yml',
      'platformatic.service.toml',
      'platformatic.service.tml',
      'platformatic.json',
      'platformatic.json5',
      'platformatic.yaml',
      'platformatic.yml',
      'platformatic.toml',
      'platformatic.tml'
    ])
  }
})

test('not passing validation kills the process', async t => {
  t.plan(2)
  function app () {
  }
  app.configType = 'service'
  app.schema = {
    $id: 'service',
    type: 'object',
    properties: {
      foo: {
        type: 'string'
      }
    },
    required: ['foo']
  }

  app.configManagerConfig = {
    schema: app.schema
  }

  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  try {
    await loadConfig({}, ['-c', file, '--boo'], app)
    console.log('pass')
  } catch (err) {
    t.equal(err.message, 'The configuration does not validate against the configuration schema')
    t.same(err.validationErrors, [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}'
    }])
  }
})

test('allow-env', async (t) => {
  const file = join(__dirname, 'fixtures', 'bad-placeholder.json')
  process.env.PORT = '3000'
  const { configManager, args } = await loadConfig({}, ['-c', file, '--allow-env', 'PORT'], app)

  t.same(args, {
    _: [],
    c: file,
    config: file,
    allowEnv: 'PORT',
    'allow-env': 'PORT',
    E: 'PORT'
  })
  const content = JSON.parse(await readFile(file, 'utf8'))
  content.server.port = '3000'
  t.same(configManager.current, content)
})

test('loadConfig with Store', async t => {
  const file = join(__dirname, 'fixtures', 'with-store.json')

  const store = new Store()
  store.add(app)
  const { configManager, args } = await loadConfig({}, ['-c', file, '--boo'], store)

  t.same(args, {
    _: [],
    c: file,
    config: file,
    boo: true,
    allowEnv: '',
    'allow-env': '',
    E: ''
  })
  t.same(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('printConfigValidationErrors', async t => {
  t.plan(1)
  const table = console.table
  console.table = (data) => {
    t.same(data, [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}'
    }])
  }
  t.teardown(() => {
    console.table = table
  })
  printConfigValidationErrors({
    validationErrors: [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      foo: 'bar' // should be ignored
    }]
  })
})

test('printAndExitLoadConfigError', async t => {
  t.plan(1)
  const table = console.table
  console.table = (data) => {
    t.same(data, [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}'
    }])
  }
  t.teardown(() => {
    console.table = table
  })
  printConfigValidationErrors({
    validationErrors: [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      foo: 'bar' // should be ignored
    }]
  })
})

test('printAndExitLoadConfigError validationErrors', async t => {
  t.plan(2)
  const table = console.table
  console.table = (data) => {
    t.same(data, [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}'
    }])
  }
  const processExit = process.exit
  process.exit = (code) => {
    t.equal(code, 1)
  }
  t.teardown(() => {
    console.table = table
    process.exit = processExit
  })
  printAndExitLoadConfigError({
    validationErrors: [{
      path: '/',
      message: 'must have required property \'foo\' {"missingProperty":"foo"}',
      foo: 'bar' // should be ignored
    }]
  })
})

test('printAndExitLoadConfigError filenames', async t => {
  t.plan(2)
  const error = console.error
  console.error = (data) => {
    t.equal(data, `Missing config file!
Be sure to have a config file with one of the following names:

 * foo
 * bar

In alternative run "npm create platformatic@latest" to generate a basic plt service config.`)
  }
  const processExit = process.exit
  process.exit = (code) => {
    t.equal(code, 1)
  }
  t.teardown(() => {
    console.error = error
    process.exit = processExit
  })
  printAndExitLoadConfigError({
    filenames: ['foo', 'bar']
  })
})

test('printAndExitLoadConfigError bare error', async t => {
  t.plan(2)
  const throwed = new Error('foo')
  const error = console.error
  console.error = (data) => {
    t.equal(data, throwed)
  }
  const processExit = process.exit
  process.exit = (code) => {
    t.equal(code, 1)
  }
  t.teardown(() => {
    console.error = error
    process.exit = processExit
  })
  printAndExitLoadConfigError(throwed)
})

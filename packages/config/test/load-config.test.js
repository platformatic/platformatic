'use strict'

const { test } = require('tap')
const { loadConfig, Store } = require('../')
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

// TODO this must be refactored so that it throws an error
test('empty kills the process', async t => {
  const exit = process.exit
  process.exit = code => {
    t.equal(code, 1)
    throw new Error('exit')
  }

  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures', 'empty'))
  t.teardown(() => {
    process.chdir(cwd)
    process.exit = exit
  })

  await t.rejects(loadConfig({}, [], app), new Error('exit'))
})

// TODO this must be refactored so that it throws an error
test('not passing validation kills the process', async t => {
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

  const exit = process.exit
  process.exit = code => {
    t.equal(code, 1)
    throw new Error('exit')
  }
  t.teardown(() => {
    process.exit = exit
  })

  const file = join(__dirname, 'fixtures', 'platformatic.service.json')
  await t.rejects(loadConfig({}, ['-c', file, '--boo'], app), new Error('exit'))
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

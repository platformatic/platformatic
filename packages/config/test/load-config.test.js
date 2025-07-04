'use strict'

const assert = require('node:assert/strict')
const { readFile, mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { test } = require('node:test')
const { saveConfigToFile } = require('./helper')
const {
  loadConfig,
  loadEmptyConfig,
  findConfigurationFile,
  Store,
  printConfigValidationErrors,
  printAndExitLoadConfigError,
  loadConfigurationFile
} = require('../')

function app () {}
app.configType = 'service'
app.schema = {
  $id: 'service',
  type: 'object'
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
    boo: true
  })
  assert.deepEqual(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('watt.json', async t => {
  {
    const cwd = process.cwd()
    process.chdir(join(__dirname, 'fixtures', 'app2'))
    t.after(() => {
      process.chdir(cwd)
    })
  }

  const file = join(__dirname, 'fixtures', 'app2', 'watt.json')
  const { configManager, args } = await loadConfig({}, [], app)

  assert.deepEqual(args, {
    _: []
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
    _: []
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
      'watt.json',
      'watt.json5',
      'watt.yaml',
      'watt.yml',
      'watt.toml',
      'watt.tml'
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
  } catch (err) {
    assert.equal(err.message, 'The configuration does not validate against the configuration schema')
    assert.deepEqual(err.validationErrors, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}'
      }
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
    boo: true
  })
  assert.deepEqual(configManager.current, JSON.parse(await readFile(file, 'utf8')))
})

test('loadEmptyConfig', async t => {
  const { configManager, args } = await loadEmptyConfig(join(__dirname, 'fixtures'), app)

  assert.deepEqual(args, {})
  assert.deepEqual(configManager.current, {})
})

test('findConfigurationFile finds a configuration file', async t => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, null, null, ['platformatic.json'])
  assert.equal(found, targetFile)
})

test('findConfigurationFile returns null if no file found', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'plt-config-test-'))

  const found = await findConfigurationFile(tempDir, null, 'service')
  assert.equal(found, null)
})

test('findConfigurationFile with specified file path', async t => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config, 'custom-config.json')
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, 'custom-config.json', 'service')
  assert.equal(found, targetFile)
})

test('findConfigurationFile with schema validation', async t => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  // Should find with matching schema
  const found = await findConfigurationFile(configDir, null, 'service')
  assert.equal(found, targetFile)

  // Should not find with non-matching schema
  const notFound = await findConfigurationFile(configDir, null, 'https://platformatic.dev/schemas/v1.0.0/db')
  assert.equal(notFound, null)
})

test('findConfigurationFile with multiple schemas', async t => {
  const config = { hello: 'world', $schema: 'https://platformatic.dev/schemas/v1.0.0/service' }
  const targetFile = await saveConfigToFile(config)
  const configDir = dirname(targetFile)

  const found = await findConfigurationFile(configDir, null, ['db', 'service'])
  assert.equal(found, targetFile)
})

test('loadConfigurationFile loads and parses config file', async t => {
  const config = { hello: 'world', nested: { value: 42 } }
  const targetFile = await saveConfigToFile(config)

  const loaded = await loadConfigurationFile(targetFile)
  assert.deepEqual(loaded, config)
})

test('loadConfigurationFile handles different file formats', async t => {
  // Test with JSON5
  const configJSON5 = { hello: 'world', nested: { value: 42 } }
  const targetFileJSON5 = await saveConfigToFile(configJSON5, 'config.json5')

  const loadedJSON5 = await loadConfigurationFile(targetFileJSON5)
  assert.deepEqual(loadedJSON5, configJSON5)

  // Test with YAML
  const configYAML = { hello: 'world', nested: { value: 42 } }
  const tempDirYAML = await mkdtemp(join(tmpdir(), 'plt-config-test-'))
  const targetFileYAML = join(tempDirYAML, 'config.yaml')
  const yamlContent = 'hello: world\nnested:\n  value: 42'
  await writeFile(targetFileYAML, yamlContent)

  const loadedYAML = await loadConfigurationFile(targetFileYAML)
  assert.deepEqual(loadedYAML, configYAML)
})

test('printConfigValidationErrors', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}'
      }
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
        foo: 'bar' // should be ignored
      }
    ]
  })
})

test('printAndExitLoadConfigError', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}'
      }
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
        foo: 'bar' // should be ignored
      }
    ]
  })
})

test('printAndExitLoadConfigError validationErrors', async t => {
  const table = console.table
  console.table = data => {
    assert.deepEqual(data, [
      {
        path: '/',
        message: 'must have required property \'foo\' {"missingProperty":"foo"}'
      }
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
        foo: 'bar' // should be ignored
      }
    ]
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

In alternative run "npm create platformatic@latest" to generate a basic @platformatic/service config.`
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
    filenames: ['foo', 'bar']
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

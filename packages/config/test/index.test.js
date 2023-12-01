'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join, resolve } = require('node:path')
const { unlink, writeFile, mkdir } = require('node:fs/promises')
const ConfigManager = require('..')
const pid = process.pid

test('should compute absolute path', () => {
  const cm = new ConfigManager({ source: './test.json' })
  assert.equal(cm.fullPath, resolve(process.cwd(), './test.json'))
})

test('should throw if both path and config are not defined', async (t) => {
  try {
    const cm = new ConfigManager({})
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Source missing.')
  }
})

test('should accept and parse initial config object', async (t) => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    }
  })
  await cm.parse()
  assert.deepEqual(cm.current, {
    server: {
      hostname: '127.0.0.1',
      port: '3042'
    }
  })
})

test('dirname option', async (t) => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    },
    dirname: 'foobar'
  })
  await cm.parse()
  assert.equal(cm.dirname, 'foobar')
})

test('dirname as cwd', async (t) => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    }
  })
  await cm.parse()
  assert.equal(cm.dirname, process.cwd())
})

test('should purge env', (t) => {
  {
    // passed env
    const cm = new ConfigManager({
      source: './test.json',
      env: {
        FOOBAR: 'foobar',
        PLT_FOOBAR: 'plt_foobar'
      }
    })

    assert.deepEqual(cm.env, {
      PLT_FOOBAR: 'plt_foobar'
    })
  }
  {
    // from process env
    process.env.FOOBAR = 'foobar'
    process.env.PLT_FOOBAR = 'plt_foobar'
    const cm = new ConfigManager({ source: './fixtures/test.json' })
    t.after(() => {
      delete process.env.FOOBAR
      delete process.env.PLT_FOOBAR
    })
    assert.deepEqual(cm.env, {
      PLT_FOOBAR: 'plt_foobar'
    })
  }
})

test('support env white list', (t) => {
  {
    // passed env
    const cm = new ConfigManager({
      source: './test.json',
      env: {
        FOOBAR: 'foobar',
        PLT_FOOBAR: 'plt_foobar'
      },
      envWhitelist: ['FOOBAR']
    })

    assert.deepEqual(cm.env, {
      PLT_FOOBAR: 'plt_foobar',
      FOOBAR: 'foobar'
    })
  }
  {
    // from process env
    process.env.FOOBAR = 'foobar'
    process.env.PLT_FOOBAR = 'plt_foobar'
    const cm = new ConfigManager({ source: './fixtures/test.json', envWhitelist: ['FOOBAR'] })
    t.after(() => {
      delete process.env.FOOBAR
      delete process.env.PLT_FOOBAR
    })
    assert.deepEqual(cm.env, {
      PLT_FOOBAR: 'plt_foobar',
      FOOBAR: 'foobar'
    })
  }
})

test('should not validate if parsing is not called', (t) => {
  const cm = new ConfigManager({
    source: './test.json'
  })
  assert.deepEqual(cm.validate(), false)
})

test('should throw if file is not JSON, yaml, or toml', async (t) => {
  try {
    const cm = new ConfigManager({
      source: './test.txt'
    })
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
  }
})

test('should look for a .env file in the same folder of config', async () => {
  const tmpDir = join(tmpdir(), `plt-auth-${pid}`)
  await mkdir(tmpDir)
  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = join(tmpDir, 'uses-env.json')
  const envFile = join(tmpDir, '.env')

  await writeFile(envFile, 'PLT_PROP=foo\n')
  await writeFile(file, JSON.stringify(config))

  const cm = new ConfigManager({ source: file, schema })
  await cm.parse()
  const expectedConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foo'
    }
  }
  assert.deepEqual(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

test('should look for a .env file in process.cwd() too', async (t) => {
  const currentCWD = process.cwd()
  t.after(() => process.chdir(currentCWD))

  const tmpDir = join(tmpdir(), `plt-auth-${pid}-2`)
  const tmpDir2 = join(tmpdir(), `plt-auth-${pid}-2-cwd`)
  await mkdir(tmpDir)
  await mkdir(tmpDir2)

  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = join(tmpDir, 'uses-env.json')
  const envFile = join(tmpDir2, '.env')

  await writeFile(envFile, 'PLT_PROP=foo\n')
  await writeFile(file, JSON.stringify(config))

  process.chdir(tmpDir2)

  const cm = new ConfigManager({ source: file, schema })
  await cm.parse()
  const expectedConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foo'
    }
  }
  assert.deepEqual(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

test('ConfigManager.listConfigFiles() lists possible configs by type', async (t) => {
  assert.deepEqual(ConfigManager.listConfigFiles('db'), [
    'platformatic.db.json',
    'platformatic.db.json5',
    'platformatic.db.yaml',
    'platformatic.db.yml',
    'platformatic.db.toml',
    'platformatic.db.tml',
    'platformatic.json',
    'platformatic.json5',
    'platformatic.yaml',
    'platformatic.yml',
    'platformatic.toml',
    'platformatic.tml'
  ])
  assert.deepEqual(ConfigManager.listConfigFiles('service'), [
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
  assert.deepEqual(ConfigManager.listConfigFiles('runtime'), [
    'platformatic.runtime.json',
    'platformatic.runtime.json5',
    'platformatic.runtime.yaml',
    'platformatic.runtime.yml',
    'platformatic.runtime.toml',
    'platformatic.runtime.tml',
    'platformatic.json',
    'platformatic.json5',
    'platformatic.yaml',
    'platformatic.yml',
    'platformatic.toml',
    'platformatic.tml'
  ])
})

test('ConfigManager.listConfigFiles() lists all possible configs', async (t) => {
  assert.deepEqual(ConfigManager.listConfigFiles(), [
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
    'platformatic.tml',
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
    'platformatic.runtime.json',
    'platformatic.runtime.json5',
    'platformatic.runtime.yaml',
    'platformatic.runtime.yml',
    'platformatic.runtime.toml',
    'platformatic.runtime.tml'
  ])
})

test('ConfigManager.findConfigFile() finds configs by type', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures')
  assert.deepEqual(
    await ConfigManager.findConfigFile(fixturesDir, 'db'),
    'platformatic.db.json'
  )
  assert.deepEqual(
    await ConfigManager.findConfigFile(fixturesDir, 'service'),
    'platformatic.service.json'
  )
})

test('ConfigManager.findConfigFile() finds configs without type', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures')
  assert.deepEqual(
    await ConfigManager.findConfigFile(fixturesDir),
    'platformatic.service.json'
  )
})

test('ConfigManager.findConfigFile() searches cwd by default', async (t) => {
  assert.deepEqual(
    await ConfigManager.findConfigFile(),
    undefined
  )
})

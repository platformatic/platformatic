'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test, describe } = require('node:test')
const { join, resolve } = require('node:path')
const { unlink, writeFile } = require('node:fs/promises')
const ConfigManager = require('..')
const pid = process.pid
const { tspl } = require('@matteo.collina/tspl')
const { createDirectory } = require('@platformatic/utils')

test('should compute absolute path', () => {
  const cm = new ConfigManager({ source: './test.json' })
  assert.equal(cm.fullPath, resolve(process.cwd(), './test.json'))
})

test('should throw if both path and config are not defined', async t => {
  try {
    const cm = new ConfigManager({})
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Source missing.')
  }
})

test('should accept and parse initial config object', async t => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042',
      },
    },
  })
  await cm.parse()
  assert.deepEqual(cm.current, {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
    },
  })
})

test('dirname option', async t => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042',
      },
    },
    dirname: 'foobar',
  })
  await cm.parse()
  assert.equal(cm.dirname, 'foobar')
})

test('dirname as cwd', async t => {
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042',
      },
    },
  })
  await cm.parse()
  assert.equal(cm.dirname, process.cwd())
})

test('should used passed env vars', t => {
  {
    // passed env
    const cm = new ConfigManager({
      source: './test.json',
      env: {
        FOOBAR: 'foobar',
        PLT_FOOBAR: 'plt_foobar',
      },
    })
    assert.deepStrictEqual(cm.env, {
      FOOBAR: 'foobar',
      PLT_FOOBAR: 'plt_foobar',
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
    assert.deepStrictEqual(cm.env, {})
  }
})

test('should not validate if parsing is not called', t => {
  const cm = new ConfigManager({
    source: './test.json',
  })
  assert.deepEqual(cm.validate(), false)
})

test('should throw if file is not JSON, yaml, or toml', async t => {
  try {
    const cm = new ConfigManager({
      source: './test.txt',
    })
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
  }
})

test('should look for a .env file in the same folder of config', async () => {
  const tmpDir = join(tmpdir(), `plt-auth-${pid}`)
  await createDirectory(tmpDir)
  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}',
    },
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' },
        },
      },
    },
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
      foo: 'foo',
    },
  }
  assert.deepEqual(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

test('should look for a .env file in process.cwd() too', async t => {
  const currentCWD = process.cwd()
  t.after(() => process.chdir(currentCWD))

  const tmpDir = join(tmpdir(), `plt-auth-${pid}-2`)
  const tmpDir2 = join(tmpdir(), `plt-auth-${pid}-2-cwd`)
  await createDirectory(tmpDir)
  await createDirectory(tmpDir2)

  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}',
    },
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' },
        },
      },
    },
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
      foo: 'foo',
    },
  }
  assert.deepEqual(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

test('ConfigManager.listConfigFiles() lists possible configs by type', async t => {
  assert.deepEqual(ConfigManager.listConfigFiles('db'), [
    'watt.json',
    'watt.json5',
    'watt.yaml',
    'watt.yml',
    'watt.toml',
    'watt.tml',
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
  ])

  assert.deepEqual(ConfigManager.listConfigFiles('service'), [
    'watt.json',
    'watt.json5',
    'watt.yaml',
    'watt.yml',
    'watt.toml',
    'watt.tml',
    'platformatic.json',
    'platformatic.json5',
    'platformatic.yaml',
    'platformatic.yml',
    'platformatic.toml',
    'platformatic.tml',
    'platformatic.service.json',
    'platformatic.service.json5',
    'platformatic.service.yaml',
    'platformatic.service.yml',
    'platformatic.service.toml',
    'platformatic.service.tml',
  ])

  assert.deepEqual(ConfigManager.listConfigFiles('runtime'), [
    'watt.json',
    'watt.json5',
    'watt.yaml',
    'watt.yml',
    'watt.toml',
    'watt.tml',
    'platformatic.json',
    'platformatic.json5',
    'platformatic.yaml',
    'platformatic.yml',
    'platformatic.toml',
    'platformatic.tml',
    'platformatic.runtime.json',
    'platformatic.runtime.json5',
    'platformatic.runtime.yaml',
    'platformatic.runtime.yml',
    'platformatic.runtime.toml',
    'platformatic.runtime.tml',
  ])
})

test('ConfigManager.listConfigFiles() lists all possible configs', async t => {
  assert.deepEqual(ConfigManager.listConfigFiles(), [
    'watt.json',
    'watt.json5',
    'watt.yaml',
    'watt.yml',
    'watt.toml',
    'watt.tml',
    'platformatic.json',
    'platformatic.json5',
    'platformatic.yaml',
    'platformatic.yml',
    'platformatic.toml',
    'platformatic.tml',
    'platformatic.runtime.json',
    'platformatic.runtime.json5',
    'platformatic.runtime.yaml',
    'platformatic.runtime.yml',
    'platformatic.runtime.toml',
    'platformatic.runtime.tml',
    'platformatic.service.json',
    'platformatic.service.json5',
    'platformatic.service.yaml',
    'platformatic.service.yml',
    'platformatic.service.toml',
    'platformatic.service.tml',
    'platformatic.application.json',
    'platformatic.application.json5',
    'platformatic.application.yaml',
    'platformatic.application.yml',
    'platformatic.application.toml',
    'platformatic.application.tml',
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
  ])
})

test('ConfigManager.findConfigFile() finds configs by type', async t => {
  const fixturesDir = join(__dirname, 'fixtures')
  assert.deepEqual(await ConfigManager.findConfigFile(fixturesDir, 'db'), 'platformatic.db.json')
  assert.deepEqual(await ConfigManager.findConfigFile(fixturesDir, 'service'), 'platformatic.service.json')
})

test('ConfigManager.findConfigFile() finds configs without type', async t => {
  const fixturesDir = join(__dirname, 'fixtures')
  assert.deepEqual(await ConfigManager.findConfigFile(fixturesDir), 'platformatic.service.json')
})

test('ConfigManager.findConfigFile() searches cwd by default', async t => {
  assert.deepEqual(await ConfigManager.findConfigFile(), undefined)
})

test('should throw if there is upgrade but not version', async t => {
  try {
    // eslint-disable-next-line no-new
    new ConfigManager({
      upgrade () { },
    })
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'version is required if upgrade is specified.')
  }
})

describe('upgrade', () => {
  test('missing configVersion with platformatic URL schema', async t => {
    const plan = tspl(t, { plan: 1 })
    const cm = new ConfigManager({
      version: '1.0.0',
      source: {
        $schema: 'https://platformatic.dev/schemas/v0.42.0/something.json',
        server: {
          hostname: '127.0.0.1',
          port: '3042',
        },
      },
      upgrade (config, origin) {
        plan.equal(origin, '0.42.0')
        return config
      },
    })
    await cm.parse()
  })

  test('missing configVersion with version in module', async t => {
    const plan = tspl(t, { plan: 1 })
    const cm = new ConfigManager({
      version: '1.0.0',
      source: {
        module: './foo.js@0.42.0',
        server: {
          hostname: '127.0.0.1',
          port: '3042',
        },
      },
      upgrade (config, origin) {
        plan.equal(origin, '0.42.0')
        return config
      },
    })
    await cm.parse()
  })

  test('missing configVersion with version in module', async t => {
    const plan = tspl(t, { plan: 1 })
    const cm = new ConfigManager({
      version: '1.0.0',
      source: join(__dirname, 'fixtures', 'service-old.json'),
      upgrade (config, origin) {
        plan.equal(origin, '0.15.0')
        return config
      },
    })
    await cm.parse()
  })

  test("if all things fails, it's a legacy app", async t => {
    const plan = tspl(t, { plan: 1 })
    const cm = new ConfigManager({
      version: '1.0.0',
      source: join(__dirname, 'fixtures', 'db-0.16.0-empty.json'),
      upgrade (config, origin) {
        plan.equal(origin, '0.15.0')
        return config
      },
    })
    await cm.parse()
  })
})

test('configManager.parse should skip validation and transformation if asked', async () => {
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar',
    },
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' },
        },
        required: ['foo', 'bar'],
      },
    },
  }

  const cm = new ConfigManager({
    source: config,
    schema,
    transformConfig () {
      assert.fail('should not be called')
    }
  })
  await cm.parse({}, [], { validate: false, transform: false })
  assert.deepEqual(cm.current, config)
})

test('should not load .env file when disableEnvLoad is true', async () => {
  const tmpDir = join(tmpdir(), `plt-${pid}-disable-env`)
  await createDirectory(tmpDir)
  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}',
    },
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' },
        },
      },
    },
  }

  const file = join(tmpDir, 'uses-env.json')
  const envFile = join(tmpDir, '.env')

  await writeFile(envFile, 'PLT_PROP=fighters\n')
  await writeFile(file, JSON.stringify(config))

  const cm = new ConfigManager({
    source: file,
    schema,
    disableEnvLoad: true
  })
  await cm.parse()

  assert.strictEqual(cm.current.props.foo, '')
  assert.deepEqual(cm.current, {
    name: 'Platformatic',
    props: {
      foo: '',
    },
  }, 'The variable from .env file should not be loaded, so PLT_PROP should remain as is in the output')

  const cm2 = new ConfigManager({
    source: file,
    schema
  })
  await cm2.parse()
  assert.strictEqual(cm2.current.props.foo, 'fighters')
  assert.deepEqual(cm2.current, {
    name: 'Platformatic',
    props: {
      foo: 'fighters',
    },
  }, 'Now the .env variable has been overrided because disableEnvLoad is not defined (and therefore it is defaulted to the "false" logic)')

  await unlink(file)
  await unlink(envFile)
})

'use strict'

const { test } = require('tap')
const { resolve } = require('path')
const ConfigManager = require('..')
const path = require('path')
const { unlink, writeFile, mkdir } = require('fs/promises')
const os = require('os')
const pid = process.pid

test('should compute absolute path', ({ equal, plan }) => {
  plan(1)
  const cm = new ConfigManager({ source: './test.json' })
  equal(cm.fullPath, resolve(process.cwd(), './test.json'))
})

test('should throw if both path and config are not defined', async ({ equal, plan, fail }) => {
  plan(1)
  try {
    const cm = new ConfigManager({})
    await cm.parse()
    fail()
  } catch (err) {
    equal(err.message, 'Source missing.')
  }
})

test('should accept and parse initial config object', async ({ same, equal, plan }) => {
  plan(1)
  const cm = new ConfigManager({
    source: {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    }
  })
  await cm.parse()
  same(cm.current, {
    server: {
      hostname: '127.0.0.1',
      port: '3042'
    }
  })
})

test('should purge env', ({ plan, same, teardown }) => {
  plan(2)
  {
    // passed env
    const cm = new ConfigManager({
      source: './test.json',
      env: {
        FOOBAR: 'foobar',
        PLT_FOOBAR: 'plt_foobar'
      }
    })

    same(cm.env, {
      PLT_FOOBAR: 'plt_foobar'
    })
  }
  {
    // from process env
    process.env.FOOBAR = 'foobar'
    process.env.PLT_FOOBAR = 'plt_foobar'
    const cm = new ConfigManager({ source: './fixtures/test.json' })
    teardown(() => {
      delete process.env.FOOBAR
      delete process.env.PLT_FOOBAR
    })
    same(cm.env, {
      PLT_FOOBAR: 'plt_foobar'
    })
  }
})

test('support env white list', ({ plan, same, teardown }) => {
  plan(2)
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

    same(cm.env, {
      PLT_FOOBAR: 'plt_foobar',
      FOOBAR: 'foobar'
    })
  }
  {
    // from process env
    process.env.FOOBAR = 'foobar'
    process.env.PLT_FOOBAR = 'plt_foobar'
    const cm = new ConfigManager({ source: './fixtures/test.json', envWhitelist: ['FOOBAR'] })
    teardown(() => {
      delete process.env.FOOBAR
      delete process.env.PLT_FOOBAR
    })
    same(cm.env, {
      PLT_FOOBAR: 'plt_foobar',
      FOOBAR: 'foobar'
    })
  }
})

test('should not validate if parsing is not called', ({ plan, same, teardown }) => {
  plan(1)
  const cm = new ConfigManager({
    source: './test.json'
  })
  same(cm.validate(), false)
})

test('should throw if file is not JSON, yaml, or toml', async ({ fail, equal, plan }) => {
  plan(1)
  try {
    const cm = new ConfigManager({
      source: './test.txt'
    })
    await cm.parse()
    fail()
  } catch (err) {
    equal(err.message, 'Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
  }
})

test('should look for a .env file in the same folder of config', async ({ same, fail, plan, teardown, comment }) => {
  plan(1)
  const tmpDir = path.join(os.tmpdir(), `plt-auth-${pid}`)
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

  const file = path.join(tmpDir, 'uses-env.json')
  const envFile = path.join(tmpDir, '.env')

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
  same(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

test('should look for a .env file in process.cwd() too', async ({ same, fail, plan, teardown, comment }) => {
  plan(1)
  const currentCWD = process.cwd()
  teardown(() => process.chdir(currentCWD))

  const tmpDir = path.join(os.tmpdir(), `plt-auth-${pid}-2`)
  const tmpDir2 = path.join(os.tmpdir(), `plt-auth-${pid}-2-cwd`)
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

  const file = path.join(tmpDir, 'uses-env.json')
  const envFile = path.join(tmpDir2, '.env')

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
  same(cm.current, expectedConfig)
  await unlink(file)
  await unlink(envFile)
})

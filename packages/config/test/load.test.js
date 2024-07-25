'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { resolve } = require('node:path')
const ConfigManager = require('..')

test('should throw if file is not found', async () => {
  try {
    const cm = new ConfigManager({ source: './invalid-file.json' })
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.ok(err.message.includes('Cannot parse config file. ENOENT: no such file or directory'))
  }
})

test('should throw if placeholder is missing', async (t) => {
  try {
    const cm = new ConfigManager({ source: resolve(__dirname, './fixtures/bad-placeholder.json') })
    await cm.parse()
    assert.fail()
  } catch (err) {
    assert.equal(err.message, 'PORT env variable is missing.')
  }
})

// TODO
// test('should throw if config is invalid', ({ equal, plan }) => { })
test('should support YAML format', async (t) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.yaml'),
    env: { PLT_FOOBAR: 'foobar' },
  })
  await cm.parse()
  assert.deepEqual(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true },
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar',
  })
})

test('should support TOML format', async (t) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.toml'),
    env: { PLT_FOOBAR: 'foobar' },
  })
  await cm.parse()
  cm._transformConfig = function () {
    this.current.plugin.path = this.fixRelativePath(this.current.plugin.path)
    this.current.migrations.dir = this.fixRelativePath(this.current.migrations.dir)
  }
  assert.deepEqual(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true },
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar',
  })
})

test('should support JSON5 format', async (t) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.json5'),
    env: { PLT_FOOBAR: 'foobar' },
  })
  await cm.parse()
  cm._transformConfig = function () {
    this.current.plugin.path = this.fixRelativePath(this.current.plugin.path)
    this.current.migrations.dir = this.fixRelativePath(this.current.migrations.dir)
  }
  assert.deepEqual(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true },
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar',
  })
})

test('transformConfig option', async (t) => {
  let calledTransformConfig = false
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.toml'),
    env: { PLT_FOOBAR: 'foobar' },
    transformConfig: function () {
      calledTransformConfig = true
    },
  })
  await cm.parse()
  assert.ok(calledTransformConfig)
  assert.deepEqual(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true },
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar',
  })
})

test('should NOT throw if placeholder is missing but replaceEnv is `false`', async (t) => {
  const cm = new ConfigManager({ source: resolve(__dirname, './fixtures/bad-placeholder.json') })
  await cm.parse(false)
  assert.deepEqual(cm.current,
    {
      server: {
        hostname: '127.0.0.1',
        logger: {
          level: 'info',
        },
        port: '{PORT}',
      },
      core: {
        connectionString: 'sqlite://./db.sqlite',
      },
      migrations: {
        dir: './migrations',
      },
      plugin: {
        path: './plugin-sum.js',
      },
    }

  )
})

test('should NOT throw if placeholder is missing but replaceEnv is `false` / 2', async (t) => {
  const cm = new ConfigManager({ source: resolve(__dirname, './fixtures/bad-placeholder.json') })
  await cm.parseAndValidate(false)
  assert.deepEqual(cm.current,
    {
      server: {
        hostname: '127.0.0.1',
        logger: {
          level: 'info',
        },
        port: '{PORT}',
      },
      core: {
        connectionString: 'sqlite://./db.sqlite',
      },
      migrations: {
        dir: './migrations',
      },
      plugin: {
        path: './plugin-sum.js',
      },
    }
  )
})

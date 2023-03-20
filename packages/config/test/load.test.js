'use strict'

const { test } = require('tap')
const { resolve } = require('path')
const ConfigManager = require('..')

test('should throw if file is not found', async ({ match, fail }) => {
  try {
    const cm = new ConfigManager({ source: './invalid-file.json' })
    await cm.parse()
    fail()
  } catch (err) {
    match(err.message, 'Cannot parse config file. ENOENT: no such file or directory')
  }
})

test('should throw if placeholder is invalid', async ({ match, fail }) => {
  try {
    const cm = new ConfigManager({ source: resolve(__dirname, './fixtures/bad-placeholder.json') })
    await cm.parse()
    fail()
  } catch (err) {
    match(err.message, 'PORT is an invalid placeholder. All placeholders must be prefixed with PLT_.\nDid you mean PLT_PORT?')
  }
})

test('should throw if placeholder is missing', async ({ match, fail }) => {
  try {
    const cm = new ConfigManager({ source: resolve(__dirname, './fixtures/bad-placeholder.json'), envWhitelist: ['PORT'] })
    await cm.parse()
    fail()
  } catch (err) {
    match(err.message, 'PORT env variable is missing.')
  }
})

// TODO
// test('should throw if config is invalid', ({ equal, plan }) => { })
test('should support YAML format', async ({ same }) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.yaml'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()
  same(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    dashboard: { enabled: true, path: '/' },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar'
  })
})

test('should support TOML format', async ({ same }) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.toml'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()
  cm._transformConfig = function () {
    this.current.plugin.path = this.fixRelativePath(this.current.plugin.path)
    this.current.migrations.dir = this.fixRelativePath(this.current.migrations.dir)
  }
  same(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    dashboard: { enabled: true, path: '/' },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar'
  })
})

test('should support JSON5 format', async ({ same }) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.json5'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()
  cm._transformConfig = function () {
    this.current.plugin.path = this.fixRelativePath(this.current.plugin.path)
    this.current.migrations.dir = this.fixRelativePath(this.current.migrations.dir)
  }
  same(cm.current, {
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugin: { path: './plugin-sum.js' },
    core: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: { dir: './demo/auth/migrations', validateChecksums: false },
    dashboard: { enabled: true, path: '/' },
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar'
  })
})

test('should automatically update', async ({ same }) => {
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/db-0.16.0.json'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()
  same(cm.current, {
    $schema: 'https://platformatic.dev/schemas/v0.18.0/db',
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugins: { paths: ['./plugin-sum.js'] },
    db: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: { dir: './demo/migrations', validateChecksums: false },
    dashboard: { path: '/' },
    authorization: { adminSecret: 'plt-db' }
  })
})

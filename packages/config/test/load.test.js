'use strict'

const { test } = require('tap')
const { join, resolve } = require('path')
const ConfigManager = require('..')
const pkg = require('../package.json')
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici')
const { schema } = require('../../db') // avoid circular dependency on pnpm

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
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar'
  })
})

test('should automatically update', async ({ same, teardown, pass, plan }) => {
  plan(2)
  const _agent = getGlobalDispatcher()
  const mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  teardown(() => {
    setGlobalDispatcher(_agent)
  })

  // Provide the base url to the request
  const mockPool = mockAgent.get('https://platformatic.dev')
  mockAgent.disableNetConnect()

  // intercept the request
  mockPool.intercept({
    path: `/schemas/v${pkg.version}/db`,
    method: 'GET'
  }).reply(404, () => {
    pass('should have called the mock server')
    return {
      message: 'not found'
    }
  })

  const fixturesDir = join(__dirname, 'fixtures')
  const cm = new ConfigManager({
    source: join(fixturesDir, 'db-0.16.0.json'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()

  same(cm.current, {
    $schema: `https://platformatic.dev/schemas/v${pkg.version}/db`,
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugins: { paths: ['./plugin-sum.js'] },
    db: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: {
      dir: './demo/migrations',
      validateChecksums: false
    },
    authorization: { adminSecret: 'plt-db' },
    watch: {
      ignore: ['*.sqlite', '*.sqlite-journal']
    }
  })
})

test('should use the remote schema', async ({ same, teardown, pass, plan }) => {
  plan(2)
  const _agent = getGlobalDispatcher()
  const mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  teardown(() => {
    setGlobalDispatcher(_agent)
  })

  // Provide the base url to the request
  const mockPool = mockAgent.get('https://platformatic.dev')
  mockAgent.disableNetConnect()

  // intercept the request
  mockPool.intercept({
    path: `/schemas/v${pkg.version}/db`,
    method: 'GET'
  }).reply(200, () => {
    pass('should have called the mock server')
    return JSON.stringify(schema)
  })

  const fixturesDir = join(__dirname, 'fixtures')
  const cm = new ConfigManager({
    source: join(fixturesDir, 'db-0.16.0.json'),
    env: { PLT_FOOBAR: 'foobar' }
  })
  await cm.parse()

  same(cm.current, {
    $schema: `https://platformatic.dev/schemas/v${pkg.version}/db`,
    server: { hostname: '127.0.0.1', port: '3042', logger: { level: 'info' } },
    metrics: { auth: { username: 'plt-db', password: 'plt-db' } },
    plugins: { paths: [join(fixturesDir, 'plugin-sum.js')] },
    db: {
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
      graphiql: true,
      ignore: { versions: true }
    },
    migrations: {
      dir: join(fixturesDir, 'demo', 'migrations'),
      validateChecksums: false
    },
    authorization: { adminSecret: 'plt-db' },
    watch: {
      ignore: ['*.sqlite', '*.sqlite-journal']
    }
  })
})

test('transformConfig option', async ({ same, plan, pass }) => {
  plan(2)
  const cm = new ConfigManager({
    source: resolve(__dirname, './fixtures/simple.toml'),
    env: { PLT_FOOBAR: 'foobar' },
    transformConfig: function () {
      pass('should call transformConfig')
    }
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
    authorization: { adminSecret: 'plt-db' },
    foobar: 'foobar'
  })
})

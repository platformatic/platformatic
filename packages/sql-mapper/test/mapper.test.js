
const { test } = require('tap')
const { connect, plugin } = require('..')
const { clear, connInfo, isPg, isMysql, isSQLite } = require('./helper')
const fastify = require('fastify')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('should throw if no connection string is provided', async ({ equal }) => {
  try {
    await connect({
      connectionString: false
    })
  } catch (err) {
    equal(err.message, 'connectionString is required')
  }
})

test('[PG] return entities', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('[mysql] return entities', { skip: !isMysql }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('[sqlite] return entities', { skip: !isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    teardown(async () => await clear(db, sql))
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('ignore tables', async ({ teardown, has }) => {
  async function onDatabaseLoad (db, sql) {
    teardown(async () => await clear(db, sql))
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)

    await db.query(sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: { users: true },
    hooks: {}
  })
  has(mapper.entities.users, undefined)
})

test('[PG] return entities with Fastify', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    teardown(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  teardown(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad
  })
  await app.ready()
  const pageEntity = app.platformatic.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('[mysql] return entities', { skip: !isMysql }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    teardown(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  teardown(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  await app.ready()
  const pageEntity = app.platformatic.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('[sqlite] return entities', { skip: !isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    teardown(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  teardown(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  await app.ready()
  const pageEntity = app.platformatic.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('missing connectionString', async ({ rejects }) => {
  const app = fastify()
  app.register(plugin)

  await rejects(app.ready(), /connectionString/)
})

test('[pg] throws if no primary key', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL,
      title VARCHAR(255) NOT NULL
    );`)
  }
  try {
    await connect({
      connectionString: connInfo.connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {}
    })
  } catch (err) {
    equal(err.message, 'Cannot find primary key for Page entity')
  }
})

test('[mysql] throws if no primary key', { skip: !isMysql }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE pages (
      id SERIAL,
      title VARCHAR(255) NOT NULL
    );`)
  }
  try {
    await connect({
      connectionString: connInfo.connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {}
    })
  } catch (err) {
    equal(err.message, 'Cannot find primary key for Page entity')
  }
})

test('[sqlite] throws if primary key is not defined', { skip: !isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE TABLE pages(
      id INTEGER NOT NULL,
      title TEXT NOT NULL
   );
   `)
  }
  try {
    await connect({
      connectionString: connInfo.connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {}
    })
  } catch (err) {
    equal(err.message, 'Cannot find primary key for Page entity')
  }
})

test('[sqlite] throws with multiple primary keys', { skip: !isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE TABLE pages(
      id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      PRIMARY KEY (id, author_id)
   );
   `)
  }
  try {
    await connect({
      connectionString: connInfo.connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {}
    })
  } catch (err) {
    equal(err.message, 'Table pages has 2 primary keys')
  }
})

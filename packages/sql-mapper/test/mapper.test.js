'use strict'

const { test } = require('node:test')
const { ok, equal, rejects, deepEqual } = require('node:assert')
const { connect, plugin } = require('..')
const { clear, connInfo, isPg, isMysql, isSQLite } = require('./helper')
const fastify = require('fastify')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

test('should throw if no connection string is provided', async () => {
  try {
    await connect({
      connectionString: false
    })
  } catch (err) {
    equal(err.message, 'connectionString is required')
  }
})

test('[PG] return entities', { skip: !isPg }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(() => db.dispose())

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
  ok(true)
})

test('[mysql] return entities', { skip: !isMysql }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(() => db.dispose())

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
  ok(true)
})

test('[sqlite] return entities', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))
    test.after(() => db.dispose())

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
  ok(true)
})

test('ignore tables', async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))
    test.after(() => db.dispose())

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
  equal(mapper.entities.users, undefined)
})

test('[PG] return entities with Fastify', { skip: !isPg }, async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  test.after(() => app.close())
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
  ok(true)
})

test('[mysql] return entities', { skip: !isMysql }, async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  test.after(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  await app.ready()
  const pageEntity = app.platformatic.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  ok(true)
})

test('[sqlite] return entities', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  test.after(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  await app.ready()
  const pageEntity = app.platformatic.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  ok(true)
})

test('missing connectionString', async () => {
  const app = fastify()
  app.register(plugin)

  await rejects(app.ready(), /connectionString/)
})

test('platformaticContext', async () => {
  async function onDatabaseLoad (db, sql) {
    test.after(async () => await clear(db, sql))

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const app = fastify()
  test.after(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })

  app.get('/', function (req, reply) {
    const ctx = req.platformaticContext
    equal(app, ctx.app)
    equal(reply, ctx.reply)
    return 'hello world'
  })

  const res = await app.inject('/')
  equal(res.statusCode, 200)
})

test('platformatic decorator already present', async () => {
  async function onDatabaseLoad (db, sql) {
  }
  const app = fastify()
  app.decorate('platformatic', {})
  test.after(() => app.close())
  app.register(plugin, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  await app.ready()
})

test('clean up all tables', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => await clear(db, sql))
    test.after(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad
  })

  const res = await mapper.entities.page.save({ input: { title: 'hello' } })

  deepEqual(await mapper.entities.page.find(), [res])

  await mapper.cleanUpAllEntities()

  const pages = await mapper.entities.page.find()
  equal(pages.length, 0)
})

test('clean up all tables with foreign keys', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => await clear(db, sql))
    test.after(() => db.dispose())

    if (db.isSQLite) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
      await db.query(sql`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY,
        text VARCHAR(255) NOT NULL,
        page_id INTEGER NOT NULL REFERENCES pages(id)
      );`)
    } else if (db.isPg) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
      await db.query(sql`CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        text VARCHAR(255) NOT NULL,
        page_id INTEGER NOT NULL REFERENCES pages(id)
      );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL
      );`)
      await db.query(sql`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        text VARCHAR(255) NOT NULL,
        page_id INTEGER NOT NULL REFERENCES pages(id)
      );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad
  })

  {
    const p1 = await mapper.entities.page.save({ input: { title: 'hello' } })
    deepEqual(await mapper.entities.page.find(), [p1])

    const c1 = await mapper.entities.comment.save({ input: { text: 'foo', pageId: p1.id } })
    deepEqual(await mapper.entities.comment.find(), [c1])
  }

  await mapper.cleanUpAllEntities()

  const pages = await mapper.entities.page.find()
  equal(pages.length, 0)

  const comments = await mapper.entities.comment.find()
  equal(comments.length, 0)
})

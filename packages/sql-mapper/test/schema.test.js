const { test } = require('tap')
const { connect } = require('..')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

// Schemas are supported only by postgres for the time being
// We need to encode the schemas
const connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
const isPg = !process.env.DB || process.env.DB === 'postgresql'
const clear = async function (db, sql) {
  try {
    await db.query(sql`DROP TABLE test1.pages`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE test2.users`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE test2.pages`)
  } catch (err) {
  }
}

test('[pg] uses tables from different schemas', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: ['test1', 'test2']
  })
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  const userEntity = mapper.entities.user
  equal(userEntity.name, 'User')
  equal(userEntity.singularName, 'user')
  equal(userEntity.pluralName, 'users')
  pass()
})

test('[pg] should fail if two schemas has the same table', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."pages" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
  }
  try {
    await connect({
      connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {},
      schema: ['test1', 'test2']
    })
  } catch (err) {
    console.log(err.message)
    equal(err.message, 'Conflicting table names: pages')
  }
})

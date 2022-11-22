const { test } = require('tap')
const { connect } = require('..')

const { connInfo, isSQLite, isMysql, isMysql8, isPg, clear } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

// const clear = async function (db, sql) {
//   try {
//     await db.query(sql`DROP TABLE test1.pages`)
//   } catch (err) {
//   }
//   try {
//     await db.query(sql`DROP TABLE test2.users`)
//   } catch (err) {
//   }
//   try {
//     await db.query(sql`DROP TABLE test2.pages`)
//   } catch (err) {
//   }
//   try {
//     await db.query(sql`DROP TABLE public.pages`)
//   } catch (err) {
//   }
//   try {
//     await db.query(sql`DROP TABLE public.posts`)
//   } catch (err) {
//   }
//   try {
//     await db.query(sql`DROP TYPE pagetype`)
//   } catch {
//   }
// }

test('uses tables from different schemas', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`users\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
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
  equal(pageEntity.schema, 'test1')
  const userEntity = mapper.entities.user
  equal(userEntity.name, 'User')
  equal(userEntity.singularName, 'user')
  equal(userEntity.pluralName, 'users')
  equal(userEntity.schema, 'test2')
  pass()
})

test('find enums correctly using schemas', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`
      CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type ENUM ('blank', 'non-blank')
    );`)
    } else if (isPg) {
      await db.query(sql`
      CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type pagetype
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type ENUM ('blank', 'non-blank')
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: ['test1']
  })
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  pass()
})

test('should fail if two schemas has the same table', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."pages" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    }
  }

  try {
    await connect({
      connectionString: connInfo.connectionString,
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

test('if schema is empty array, should not load entities from tables in explicit schema', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`users\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: []
  })

  console.log(mapper.entities)
  equal(Object.keys(mapper.entities).length, 0)
  pass()
})

test('[pg] if schema is empty array, should find entities only in default \'public\' schema', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
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
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: []
  })

  equal(Object.keys(mapper.entities).length, 1)
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  equal(pageEntity.schema, 'public')
  pass()
})

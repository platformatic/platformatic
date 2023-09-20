'use strict'

const { test } = require('tap')
const { connect } = require('..')
const { clear, connInfo, isSQLite } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
  }
}

test('ignore a table', async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {
      categories: true
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity, undefined, 'category entity is ignored')
})

test('throw an error if there is no ignored table', async ({ pass, teardown, equal, fail }) => {
  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  try {
    await connect({
      ...connInfo,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {
        missing_table_pages: true
      }
    })
    fail('should throw an error')
  } catch (err) {
    equal(err.code, 'PLT_SQL_MAPPER_IGNORED_TABLE_NOT_FOUND')
    equal(err.message, 'Ignored table "missing_table_pages" not found. Did you mean "pages"?')
  }
})

test('ignore a column', async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {
      categories: {
        name: true
      }
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity.name, 'Category')
  equal(categoryEntity.fields.id.camelcase, 'id')
  equal(categoryEntity.fields.name, undefined, 'name column is ignored')
})

test('throw an error if there is no ignored column', async ({ pass, teardown, equal, fail }) => {
  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  try {
    await connect({
      ...connInfo,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {
        categories: {
          missing_column_name: true
        }
      }
    })
    fail('should throw an error')
  } catch (err) {
    equal(err.code, 'PLT_SQL_MAPPER_IGNORED_COLUMN_NOT_FOUND')
    equal(err.message, 'Ignored column "missing_column_name" not found. Did you mean "name"?')
  }
})

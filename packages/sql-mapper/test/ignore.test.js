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

test('show a warning if there is no ignored table', async ({ plan, pass, teardown, equal }) => {
  plan(4)

  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  const logger = {
    trace: () => {},
    error: () => {},
    warn: (msg) => {
      equal(msg, 'Ignored table "missing_table_pages" not found. Did you mean "pages"?')
    }
  }

  const mapper = await connect({
    ...connInfo,
    log: logger,
    onDatabaseLoad,
    ignore: {
      missing_table_pages: true
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity.name, 'Category')
})

test('show a warning if the database is empty', async ({ plan, pass, teardown, equal }) => {
  // plan(4)

  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
  }

  const logger = {
    trace: () => {},
    error: () => {},
    warn: (msg) => {
      equal(msg, 'Ignored table "missing_table_pages" not found.')
    }
  }

  await connect({
    ...connInfo,
    log: logger,
    onDatabaseLoad,
    ignore: {
      missing_table_pages: true
    }
  })
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

test('shows a warning if there is no ignored column', async ({ plan, pass, teardown, equal }) => {
  plan(4)

  async function onDatabaseLoad (db, sql) {
    pass('onDatabaseLoad called')
    teardown(() => db.dispose())

    await clear(db, sql)
    await createBasicPages(db, sql)
  }

  const logger = {
    trace: () => {},
    error: () => {},
    warn: (msg) => {
      equal(msg, 'Ignored column "missing_column_name" not found. Did you mean "name"?')
    }
  }

  const mapper = await connect({
    ...connInfo,
    log: logger,
    onDatabaseLoad,
    ignore: {
      categories: {
        missing_column_name: true
      }
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity.name, 'Category')
})

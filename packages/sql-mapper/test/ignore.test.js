'use strict'

const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { connect } = require('..')
const { clear, connInfo, createBasicPages } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

test('ignore a table', async (t) => {
  const { ok, equal } = tspl(t, { plan: 3 })
  async function onDatabaseLoad (db, sql) {
    ok('onDatabaseLoad called')
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

test('show a warning if there is no ignored table', async (t) => {
  const { equal, ok } = tspl(t, { plan: 4 })

  async function onDatabaseLoad (db, sql) {
    ok('onDatabaseLoad called')
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

test('show a warning if the database is empty', async (t) => {
  const { ok, equal } = tspl(t, { plan: 2 })

  async function onDatabaseLoad (db, sql) {
    ok('onDatabaseLoad called')
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

test('ignore a column', async (t) => {
  const { ok, equal } = tspl(t, { plan: 5 })

  async function onDatabaseLoad (db, sql) {
    ok('onDatabaseLoad called')
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

test('shows a warning if there is no ignored column', async (t) => {
  const { equal, ok } = tspl(t, { plan: 4 })

  async function onDatabaseLoad (db, sql) {
    ok('onDatabaseLoad called')
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

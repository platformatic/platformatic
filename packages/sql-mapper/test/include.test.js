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

test('specify table to be added', async (t) => {
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
    include: {
      pages: true
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity, undefined, 'category entity is ignored')
})

test('specify tables to be added', async (t) => {
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
    include: {
      pages: true,
      categories: true
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')

  const categoryEntity = mapper.entities.category
  equal(categoryEntity.name, 'Category')
})

test('show a warning if there is no table to be included (no tables included)', async (t) => {
  const { equal, ok } = tspl(t, { plan: 3 })

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
      equal(msg, 'Specified table "missing_table_pages" not found. Did you mean "pages"?')
    }
  }

  const mapper = await connect({
    ...connInfo,
    log: logger,
    onDatabaseLoad,
    include: {
      missing_table_pages: true
    }
  })

  const pageEntity = mapper.entities.page
  equal(pageEntity, undefined, 'page entity is ignored')
})

test('include an entity and ignore a column', async (t) => {
  const { ok, equal } = tspl(t, { plan: 4 })

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
    include: {
      categories: true
    },
    ignore: {
      categories: {
        name: true
      }
    }
  })

  const categoryEntity = mapper.entities.category
  equal(categoryEntity.name, 'Category')
  equal(categoryEntity.fields.id.camelcase, 'id')
  equal(categoryEntity.fields.name, undefined, 'name column is ignored')
})

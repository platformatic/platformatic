import { deepEqual, equal, notEqual } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
}

test('views are introspected as read-only entities', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      try { await db.query(sql`DROP VIEW pages_view`) } catch {}
      await clear(db, sql)
      db.dispose()
    })

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(42)
      );`)
    }

    await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const pageEntity = mapper.entities.page
  notEqual(pageEntity, undefined)
  equal(pageEntity.isView, false)
  notEqual(pageEntity.save, undefined)
  notEqual(pageEntity.insert, undefined)
  notEqual(pageEntity.delete, undefined)
  notEqual(pageEntity.updateMany, undefined)

  const viewEntity = mapper.entities.pagesView
  notEqual(viewEntity, undefined)
  equal(viewEntity.name, 'PagesView')
  equal(viewEntity.singularName, 'pagesView')
  equal(viewEntity.pluralName, 'pagesView')
  equal(viewEntity.isView, true)
  deepEqual(viewEntity.primaryKeys, new Set())

  // Views should only have find and count methods
  notEqual(viewEntity.find, undefined)
  notEqual(viewEntity.count, undefined)
  equal(viewEntity.save, undefined)
  equal(viewEntity.insert, undefined)
  equal(viewEntity.delete, undefined)
  equal(viewEntity.updateMany, undefined)
})

test('views can be queried with find and count', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      try { await db.query(sql`DROP VIEW pages_view`) } catch {}
      await clear(db, sql)
      db.dispose()
    })

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(42)
      );`)
    }

    await db.query(sql`INSERT INTO pages (title) VALUES ('Hello')`)
    await db.query(sql`INSERT INTO pages (title) VALUES ('World')`)
    await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const viewEntity = mapper.entities.pagesView
  notEqual(viewEntity, undefined)

  // Test find
  const results = await viewEntity.find({ paginate: false })
  equal(results.length, 2)
  equal(results[0].title, 'Hello')
  equal(results[1].title, 'World')

  // Test count
  const count = await viewEntity.count({})
  equal(count, 2)

  // Test find with where
  const filtered = await viewEntity.find({
    where: {
      title: { eq: 'Hello' }
    }
  })
  equal(filtered.length, 1)
  equal(filtered[0].title, 'Hello')
})

test('views can be ignored', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      try { await db.query(sql`DROP VIEW pages_view`) } catch {}
      await clear(db, sql)
      db.dispose()
    })

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(42)
      );`)
    }

    await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {
      pages_view: true
    },
    hooks: {}
  })

  const viewEntity = mapper.entities.pagesView
  equal(viewEntity, undefined)
})

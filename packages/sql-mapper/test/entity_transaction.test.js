'use strict'

const { test } = require('tap')
const { clear, connInfo, isSQLite } = require('./helper')
const { connect } = require('..')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('entity transactions', async ({ equal, same, teardown, rejects }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())
    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
    }
    await db.query(sql`INSERT INTO pages (title) VALUES ('foo')`)
    await db.query(sql`INSERT INTO pages (title) VALUES ('bar')`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page

  // insert + rollback
  {
    const findResult = await pageEntity.find({ fields: ['title'] })
    same(findResult, [{ title: 'foo' }, { title: 'bar' }])

    try {
      await mapper.db.tx(async tx => {
        same(await pageEntity.save({
          input: { title: 'new page' },
          fields: ['title'],
          tx
        }), { title: 'new page' })
        const findResult = await pageEntity.find({ fields: ['title'], tx })
        same(findResult, [{ title: 'foo' }, { title: 'bar' }, { title: 'new page' }])
        throw new Error('rollback')
      })
    } catch (e) {
      // rollback
    }

    const afterRollback = await pageEntity.find({ fields: ['title'] })
    same(afterRollback, [{ title: 'foo' }, { title: 'bar' }])
  }

  // update + rollback
  {
    const findResult = await pageEntity.find({ fields: ['id', 'title'], where: { id: { eq: 1 } } })
    same(findResult, [{ id: 1, title: 'foo' }])

    try {
      await mapper.db.tx(async tx => {
        same(await pageEntity.save({
          input: { id: 1, title: 'changed' },
          fields: ['id', 'title'],
          tx
        }), { id: 1, title: 'changed' })
        const findResult = await pageEntity.find({ fields: ['id', 'title'], where: { id: { eq: 1 } }, tx })
        same(findResult, [{ id: 1, title: 'changed' }])
        throw new Error('rollback')
      })
    } catch (e) {
      // rollback
    }
    const afterRollback = await pageEntity.find({ fields: ['id', 'title'], where: { id: { eq: 1 } } })
    same(afterRollback, [{ id: 1, title: 'foo' }])
  }

  // delete
  {
    const findResult = await pageEntity.find({ fields: ['title'] })
    same(findResult, [{ title: 'foo' }, { title: 'bar' }])

    try {
      await mapper.db.tx(async tx => {
        same(await pageEntity.delete({
          where: {
            id: { eq: 1 }
          },
          tx
        }), [{ id: 1, title: 'foo' }])
        const findResult = await pageEntity.find({ fields: ['id', 'title'], where: { id: { eq: 1 } }, tx })
        same(findResult, [])
        throw new Error('rollback')
      })
    } catch (e) {
      // rollback
    }
    const afterRollback = await pageEntity.find({ fields: ['title'] })
    same(afterRollback, [{ title: 'foo' }, { title: 'bar' }])
  }

  // count
  {
    const countResult = await pageEntity.count()
    same(countResult, 2)
    try {
      await mapper.db.tx(async tx => {
        same(await pageEntity.save({
          input: { title: 'new page' },
          fields: ['title'],
          tx
        }), { title: 'new page' })
        const countResult = await pageEntity.count({ tx })
        same(countResult, 3)
        throw new Error('rollback')
      })
    } catch (e) {
      // rollback
    }

    const afterRollback = await pageEntity.count()
    same(afterRollback, 2)
  }
})

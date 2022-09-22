'use strict'

const { test } = require('tap')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { setTimeout } = require('timers/promises')
const { connect } = require('..')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      inserted_at TIMESTAMP,
      updated_at TIMESTAMP
    );`)
  } else if (isMysql) {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      inserted_at TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP NULL DEFAULT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      inserted_at TIMESTAMP,
      updated_at TIMESTAMP
    );`)
  }
}

test('inserted_at updated_at happy path', async ({ pass, teardown, same, equal, not, comment, notSame }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  const entity = mapper.entities.page

  equal(entity.fields.inserted_at.autoTimestamp, true)
  equal(entity.fields.updated_at.autoTimestamp, true)

  const original = await entity.save({
    input: { title: 'Hello' }
  })
  not(original.insertedAt, null, 'insertedAt')
  not(original.updatedAt, null, 'updatedAt')
  comment(`insertedAt: ${original.insertedAt}`)
  comment(`updatedAt: ${original.updatedAt}`)

  {
    const [data] = await entity.find({ where: { id: { eq: original.id } } })
    same(data.insertedAt, original.insertedAt, 'insertedAt')
    same(data.updatedAt, original.updatedAt, 'updatedAt')
    comment(`insertedAt: ${data.insertedAt}`)
    comment(`updatedAt: ${data.updatedAt}`)
  }

  await setTimeout(1000) // await 1s

  let updated
  {
    const data = await entity.save({
      input: { id: original.id, title: 'Hello World' }
    })
    same(data.insertedAt, original.insertedAt, 'insertedAt')
    notSame(data.updatedAt, original.updatedAt, 'updatedAt')
    updated = data
    comment(`insertedAt: ${data.insertedAt}`)
    comment(`updatedAt: ${data.updatedAt}`)
  }

  {
    const [data] = await entity.find({ where: { id: { eq: original.id } } })
    same(data.insertedAt, updated.insertedAt, 'insertedAt')
    same(data.updatedAt, updated.updatedAt, 'updatedAt')
    comment(`insertedAt: ${data.insertedAt}`)
    comment(`updatedAt: ${data.updatedAt}`)
  }
})

test('bulk insert adds inserted_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  const entity = mapper.entities.page

  {
    const pages = await entity.insert({
      inputs: [
        { title: 'Page 1' },
        { title: 'Page 2' },
        { title: 'Page 3' }
      ]
    })
    for (const page of pages) {
      not(page.insertedAt, null, 'insertedAt')
      not(page.updatedAt, null, 'updatedAt')
      same(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }

  {
    const pages = await entity.find()
    for (const page of pages) {
      not(page.insertedAt, null, 'insertedAt')
      not(page.updatedAt, null, 'updatedAt')
      same(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }
})

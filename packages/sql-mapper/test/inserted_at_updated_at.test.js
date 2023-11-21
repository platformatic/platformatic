'use strict'

const { test } = require('node:test')
const { ok, notEqual, notDeepEqual, deepEqual, equal } = require('node:assert')
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

test('inserted_at updated_at happy path', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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
  notEqual(original.insertedAt, null, 'insertedAt')
  notEqual(original.updatedAt, null, 'updatedAt')
  console.log(`insertedAt: ${original.insertedAt}`)
  console.log(`updatedAt: ${original.updatedAt}`)

  {
    const [data] = await entity.find({ where: { id: { eq: original.id } } })
    deepEqual(data.insertedAt, original.insertedAt, 'insertedAt')
    deepEqual(data.updatedAt, original.updatedAt, 'updatedAt')
    console.log(`insertedAt: ${data.insertedAt}`)
    console.log(`updatedAt: ${data.updatedAt}`)
  }

  await setTimeout(1000) // await 1s

  let updated
  {
    const data = await entity.save({
      input: { id: original.id, title: 'Hello World' }
    })
    deepEqual(data.insertedAt, original.insertedAt, 'insertedAt')
    notDeepEqual(data.updatedAt, original.updatedAt, 'updatedAt')
    updated = data
    console.log(`insertedAt: ${data.insertedAt}`)
    console.log(`updatedAt: ${data.updatedAt}`)
  }

  {
    const [data] = await entity.find({ where: { id: { eq: original.id } } })
    deepEqual(data.insertedAt, updated.insertedAt, 'insertedAt')
    deepEqual(data.updatedAt, updated.updatedAt, 'updatedAt')
    console.log(`insertedAt: ${data.insertedAt}`)
    console.log(`updatedAt: ${data.updatedAt}`)
  }
})

test('bulk insert adds inserted_at updated_at', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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
      notEqual(page.insertedAt, null, 'insertedAt')
      notEqual(page.updatedAt, null, 'updatedAt')
      deepEqual(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }

  {
    const pages = await entity.find()
    for (const page of pages) {
      notEqual(page.insertedAt, null, 'insertedAt')
      notEqual(page.updatedAt, null, 'updatedAt')
      deepEqual(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }
})

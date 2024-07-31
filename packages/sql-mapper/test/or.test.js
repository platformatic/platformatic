'use strict'

const { test } = require('node:test')
const { ok, deepEqual } = require('node:assert')
const { connect } = require('..')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const fakeLogger = {
  trace: () => { },
  error: () => { },
}

test('where clause with or operation', async () => {
  const mapper = await connect({
    ...connInfo,
    autoTimestamp: true,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(async () => {
        await clear(db, sql)
        db.dispose()
      })
      ok('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    },
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10,
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20,
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30,
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40,
  }]

  await entity.insert({
    inputs: posts,
  })

  {
    const data = await entity.find({
      where: {
        or: [
          {
            counter: {
              eq: 10,
            },
          },
          {
            counter: {
              eq: 20,
            },
          },
        ],
      },
    })

    deepEqual(data, [
      { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
      { id: '2', title: 'Cat', longText: 'Bar', counter: 20 },
    ])
  }

  {
    const data = await entity.find({
      where: {
        or: [
          {
            counter: {
              eq: 20,
            },
          },
          {
            counter: {
              gte: 30,
            },
          },
        ],
      },
    })

    deepEqual(data, [
      { id: '2', title: 'Cat', longText: 'Bar', counter: 20 },
      { id: '3', title: 'Mouse', longText: 'Baz', counter: 30 },
      { id: '4', title: 'Duck', longText: 'A duck tale', counter: 40 },
    ])
  }

  {
    const data = await entity.find({
      where: {
        or: [
          {
            title: {
              eq: 'Dog',
            },
          },
          {
            title: {
              eq: 'Duck',
            },
          },
        ],
      },
    })

    deepEqual(data, [
      { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
      { id: '4', title: 'Duck', longText: 'A duck tale', counter: 40 },
    ])
  }

  {
    const data = await entity.find({
      where: {
        or: [
          {
            title: {
              eq: 'Dog',
            },
          },
          {
            longText: {
              eq: 'Baz',
            },
          },
        ],
      },
    })

    deepEqual(data, [
      { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
      { id: '3', title: 'Mouse', longText: 'Baz', counter: 30 },
    ])
  }

  {
    const data = await entity.find({
      where: {
        counter: {
          in: [10, 20],
        },
        or: [
          {
            title: {
              eq: 'Dog',
            },
          },
          {
            longText: {
              eq: 'Baz',
            },
          },
        ],
      },
    })

    deepEqual(data, [
      { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
    ])
  }
})

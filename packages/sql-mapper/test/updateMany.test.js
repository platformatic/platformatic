'use strict'

const { test } = require('tap')
const { connect } = require('..')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { setTimeout } = require('timers/promises')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('updateMany successful', async ({ pass, teardown, same }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
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
    }
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await entity.insert({
    inputs: posts
  })

  await entity.updateMany({
    where: {
      counter: {
        gte: 30
      }
    },
    input: {
      title: 'Updated title'
    }
  })

  const updatedPosts = await entity.find({})

  same(updatedPosts, [{
    id: '1',
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    id: '2',
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    id: '3',
    title: 'Updated title',
    longText: 'Baz',
    counter: 30
  }, {
    id: '4',
    title: 'Updated title',
    longText: 'A duck tale',
    counter: 40
  }])
})

test('updateMany will return the updated values', async ({ pass, teardown, same }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
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
    }
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await entity.insert({
    inputs: posts
  })

  const updatedPosts = await entity.updateMany({
    where: {
      counter: {
        gte: 30
      }
    },
    input: {
      title: 'Updated title'
    }
  })

  same(updatedPosts, [{
    id: '3',
    title: 'Updated title',
    longText: 'Baz',
    counter: 30
  }, {
    id: '4',
    title: 'Updated title',
    longText: 'A duck tale',
    counter: 40
  }])
})

test('updateMany missing input', async ({ pass, teardown, rejects }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
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
    }
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await entity.insert({
    inputs: posts
  })

  rejects(entity.updateMany({
    where: {
      counter: {
        gte: 30
      }
    }
  }), new Error('Input not provided.'))
})

test('updateMany successful and update updated_at', async ({ pass, teardown, same, notSame }) => {
  const mapper = await connect({
    ...connInfo,
    autoTimestamp: true,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          inserted_at TIMESTAMP,
          updated_at TIMESTAMP
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          inserted_at TIMESTAMP NULL DEFAULT NULL,
          updated_at TIMESTAMP NULL DEFAULT NULL
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          inserted_at TIMESTAMP,
          updated_at TIMESTAMP
        );`)
      }
    }
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await entity.insert({
    inputs: posts
  })
  const createdPost3 = (await entity.find({ where: { id: { eq: '3' } } }))[0]

  await setTimeout(1000) // await 1s

  await entity.updateMany({
    where: {
      counter: {
        gte: 30
      }
    },
    input: {
      title: 'Updated title'
    }
  })

  const updatedPost3 = (await entity.find({ where: { id: { eq: '3' } } }))[0]
  same(updatedPost3.title, 'Updated title')
  same(createdPost3.insertedAt, updatedPost3.insertedAt)
  notSame(createdPost3.updatedAt, updatedPost3.updatedAt)
})

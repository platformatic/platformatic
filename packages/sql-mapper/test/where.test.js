'use strict'

const { test } = require('tap')
const { connect } = require('..')
const { clear, connInfo, isMysql, isSQLite } = require('./helper')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('list', async ({ pass, teardown, same, equal }) => {
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

  same(await entity.find({ where: { title: { eq: 'Dog' } }, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  same(await entity.find({ limit: 1, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  same(await entity.find({ offset: 3, fields: ['id', 'title', 'longText'] }), [{
    id: '4',
    title: 'Duck',
    longText: 'A duck tale'
  }])

  same(await entity.find({ limit: 1, offset: 0, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  same(await entity.find({ limit: 1, offset: 0, orderBy: [{ field: 'id', direction: 'desc' }], fields: ['id', 'title'] }), [{
    id: '4',
    title: 'Duck'
  }])

  same(await entity.find({ where: { title: { neq: 'Dog' } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }, {
    id: '4',
    title: 'Duck',
    longText: 'A duck tale'
  }])

  same(await entity.find({ where: { counter: { gt: 10 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }, {
    id: '4',
    title: 'Duck',
    longText: 'A duck tale'
  }])

  same(await entity.find({ where: { counter: { lt: 40 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }, {
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  same(await entity.find({ where: { counter: { lte: 30 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }, {
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  same(await entity.find({ where: { counter: { gte: 20 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }, {
    id: '4',
    title: 'Duck',
    longText: 'A duck tale'
  }])

  same(await entity.find({ where: { counter: { in: [20, 30] } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  same(await entity.find({ where: { counter: { nin: [10, 40] } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  same(await entity.find({ where: { counter: { gt: 10, lt: 40 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])
})

test('totalCount', async ({ pass, teardown, same, equal }) => {
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

  same(await entity.count(), 4)

  same(await entity.count({ where: { title: { eq: 'Dog' } } }), 1)

  same(await entity.count({ where: { title: { neq: 'Dog' } } }), 3)

  same(await entity.count({ limit: 2, offset: 0, fields: ['id', 'title', 'longText'] }), 4)
})

test('foreign keys', async ({ pass, teardown, same, equal }) => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE owners (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE owners (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)

        await db.query(sql`
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
        CREATE TABLE owners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        );
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          owner_id INTEGER REFERENCES owners(id)
        );`)
      }
    }
  })

  const owners = [{
    name: 'Matteo'
  }, {
    name: 'Luca'
  }]

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

  {
    const res = await mapper.entities.owner.insert({
      inputs: owners
    })
    const toAssign = [...posts]
    for (const owner of res) {
      toAssign.shift().ownerId = owner.id
      toAssign.shift().ownerId = owner.id
    }
    await mapper.entities.post.insert({
      inputs: posts
    })
  }

  {
    const owners = await mapper.entities.owner.find()
    equal(owners.length, 2)

    for (const owner of owners) {
      owner.posts = await mapper.entities.post.find({ where: { ownerId: { eq: owner.id } }, fields: ['id', 'title', 'longText', 'ownerId'] })
    }
    same(owners, [{
      id: '1',
      name: 'Matteo',
      posts: [{
        id: '1',
        title: 'Dog',
        longText: 'Foo',
        ownerId: '1'
      }, {
        id: '2',
        title: 'Cat',
        longText: 'Bar',
        ownerId: '1'
      }]
    }, {
      id: '2',
      name: 'Luca',
      posts: [{
        id: '3',
        title: 'Mouse',
        longText: 'Baz',
        ownerId: '2'
      }, {
        id: '4',
        title: 'Duck',
        longText: 'A duck tale',
        ownerId: '2'
      }]
    }])
  }
})

test('limit should be 10 by default 100 at max', async ({ pass, teardown, same, fail, match }) => {
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

  const posts = []

  for (let i = 0; i <= 105; i++) {
    posts.push({
      title: 'Dog',
      longText: 'Foo',
      counter: i
    })
  }

  await entity.insert({
    inputs: posts
  })

  const defaultLimit = 10
  const max = 100

  same(await (await entity.find()).length, defaultLimit)

  same(await (await entity.find({ limit: 1 })).length, 1)

  same(await (await entity.find({ offset: 3 })).length, defaultLimit)

  same(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  same(await (await entity.find({ limit: 0 })).length, 0)

  try {
    await entity.find({ limit: -1 })
    fail('Expected error for limit not allowed value')
  } catch (e) {
    match(e, new Error(`Param limit=-1 not allowed. It must be not negative value.`))
  }

  same(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  try {
    await entity.find({ limit: 1, offset: -1 })
    fail('Expected error for offset not allowed value')
  } catch (e) {
    match(e, new Error(`Param offset=-1 not allowed. It must be not negative value.`))
  }

  try {
    await entity.find({ limit: 200 })
    fail('Expected error for limit exceeding max allowed value')
  } catch (e) {
    match(e, new Error(`Param limit=200 not allowed. Max accepted value ${max}.`))
  }
})

test('limit must accept custom configuration', async ({ pass, teardown, same, fail, match }) => {
  const customLimitConf = {
    default: 1,
    max: 5
  }
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
    },
    limit: customLimitConf
  })

  const entity = mapper.entities.post

  const posts = []

  for (let i = 0; i <= 10; i++) {
    posts.push({
      title: 'Dog',
      longText: 'Foo',
      counter: i
    })
  }

  await entity.insert({
    inputs: posts
  })

  same(await (await entity.find()).length, customLimitConf.default)

  same(await (await entity.find({ limit: 1 })).length, 1)

  same(await (await entity.find({ offset: 3 })).length, customLimitConf.default)

  same(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  same(await (await entity.find({ limit: 0 })).length, 0)

  try {
    await entity.find({ limit: -1 })
    fail('Expected error for limit not allowed value')
  } catch (e) {
    match(e, new Error(`Param limit=-1 not allowed. It must be not negative value.`))
  }

  same(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  try {
    await entity.find({ limit: 1, offset: -1 })
    fail('Expected error for offset not allowed value')
  } catch (e) {
    match(e, new Error(`Param offset=-1 not allowed. It must be not negative value.`))
  }

  try {
    await entity.find({ limit: 200 })
    fail('Expected error for limit exceeding max allowed value')
  } catch (e) {
    match(e, new Error(`Param limit=200 not allowed. Max accepted value ${customLimitConf.max}.`))
  }
})

test('is NULL', async ({ pass, teardown, same, equal }) => {
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
          title VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42)
        );`)
      }
    }
  })

  const entity = mapper.entities.post

  const posts = [{
    title: 'Dog'
  }, {
    title: null
  }]

  await entity.insert({
    inputs: posts
  })

  same(await entity.find({ where: { title: { eq: null } } }), [{
    id: '2',
    title: null
  }])

  same(await entity.find({ where: { title: { neq: null } } }), [{
    id: '1',
    title: 'Dog'
  }])
})

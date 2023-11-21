'use strict'

const { test } = require('node:test')
const { ok, equal, deepEqual, rejects, match, ifError } = require('node:assert')
const { connect } = require('..')
const { clear, connInfo, isMysql, isSQLite } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

test('list', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  rejects(entity.find.bind(entity, { where: { invalidField: { eq: 'Dog' } } }), { message: 'Unknown field invalidField' })

  deepEqual(await entity.find({ where: { title: { eq: 'Dog' } }, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  deepEqual(await entity.find({ limit: 1, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  deepEqual(await entity.find({ offset: 3, fields: ['id', 'title', 'longText'] }), [{
    id: '4',
    title: 'Duck',
    longText: 'A duck tale'
  }])

  deepEqual(await entity.find({ limit: 1, offset: 0, fields: ['id', 'title', 'longText'] }), [{
    id: '1',
    title: 'Dog',
    longText: 'Foo'
  }])

  deepEqual(await entity.find({ limit: 1, offset: 0, orderBy: [{ field: 'id', direction: 'desc' }], fields: ['id', 'title'] }), [{
    id: '4',
    title: 'Duck'
  }])

  deepEqual(await entity.find({ where: { title: { neq: 'Dog' } }, fields: ['id', 'title', 'longText'] }), [{
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

  deepEqual(await entity.find({ where: { counter: { gt: 10 } }, fields: ['id', 'title', 'longText'] }), [{
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

  deepEqual(await entity.find({ where: { counter: { lt: 40 } }, fields: ['id', 'title', 'longText'] }), [{
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

  deepEqual(await entity.find({ where: { counter: { lte: 30 } }, fields: ['id', 'title', 'longText'] }), [{
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

  deepEqual(await entity.find({ where: { counter: { gte: 20 } }, fields: ['id', 'title', 'longText'] }), [{
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

  deepEqual(await entity.find({ where: { counter: { in: [20, 30] } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  deepEqual(await entity.find({ where: { counter: { nin: [10, 40] } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])

  deepEqual(await entity.find({ where: { counter: { gt: 10, lt: 40 } }, fields: ['id', 'title', 'longText'] }), [{
    id: '2',
    title: 'Cat',
    longText: 'Bar'
  }, {
    id: '3',
    title: 'Mouse',
    longText: 'Baz'
  }])
})

test('totalCount', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  deepEqual(await entity.count(), 4)

  deepEqual(await entity.count({ where: { title: { eq: 'Dog' } } }), 1)

  deepEqual(await entity.count({ where: { title: { neq: 'Dog' } } }), 3)

  deepEqual(await entity.count({ limit: 2, offset: 0, fields: ['id', 'title', 'longText'] }), 4)
})

test('foreign keys', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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
    deepEqual(owners, [{
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

test('limit should be 10 by default 100 at max', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  deepEqual(await (await entity.find()).length, defaultLimit)

  deepEqual(await (await entity.find({ limit: 1 })).length, 1)

  deepEqual(await (await entity.find({ offset: 3 })).length, defaultLimit)

  deepEqual(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  deepEqual(await (await entity.find({ limit: 0 })).length, 0)

  try {
    await entity.find({ limit: -1 })
    ifError('Expected error for limit not allowed value')
  } catch (e) {
    match(e.message, /Param limit=-1 not allowed. It must be a not negative value./)
    match(e.code, /PLT_SQL_MAPPER_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE/)
  }

  deepEqual(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  try {
    await entity.find({ limit: 1, offset: -1 })
    ifError('Expected error for offset not allowed value')
  } catch (e) {
    match(e.message, /Param offset=-1 not allowed. It must be not negative value./)
  }

  try {
    await entity.find({ limit: 200 })
    ifError('Expected error for limit exceeding max allowed value')
  } catch (e) {
    match(e.message, /Param limit=200 not allowed. Max accepted value [0-9]+./)
  }
})

test('limit must accept custom configuration', async () => {
  const customLimitConf = {
    default: 1,
    max: 5
  }
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  deepEqual(await (await entity.find()).length, customLimitConf.default)

  deepEqual(await (await entity.find({ limit: 1 })).length, 1)

  deepEqual(await (await entity.find({ offset: 3 })).length, customLimitConf.default)

  deepEqual(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  deepEqual(await (await entity.find({ limit: 0 })).length, 0)

  try {
    await entity.find({ limit: -1 })
    ifError('Expected error for limit not allowed value')
  } catch (e) {
    match(e.message, /Param limit=-1 not allowed. It must be a not negative value./)
    match(e.code, /PLT_SQL_MAPPER_PARAM_LIMIT_MUST_BE_NOT_NEGATIVE/)
  }

  deepEqual(await (await entity.find({ limit: 1, offset: 0 })).length, 1)

  try {
    await entity.find({ limit: 1, offset: -1 })
    ifError('Expected error for offset not allowed value')
  } catch (e) {
    match(e.message, /Param offset=-1 not allowed. It must be not negative value./)
  }

  try {
    await entity.find({ limit: 200 })
    ifError('Expected error for limit exceeding max allowed value')
  } catch (e) {
    match(e.message, /Param limit=200 not allowed. Max accepted value .*./)
  }
})

test('is NULL', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  deepEqual(await entity.find({ where: { title: { eq: null } } }), [{
    id: '2',
    title: null
  }])

  deepEqual(await entity.find({ where: { title: { neq: null } } }), [{
    id: '1',
    title: 'Dog'
  }])
})

test('LIKE', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  const posts = [
    {
      title: 'Dog',
      longText: 'The Dog barks',
      counter: 1
    },
    {
      title: 'Cat',
      longText: 'The Cat meows',
      counter: 2
    },
    {
      title: 'Potato',
      longText: 'The Potato is vegetable',
      counter: 3
    },
    {
      title: 'atmosphere',
      longText: 'The atmosphere is not a sphere',
      counter: 4
    },
    {
      title: 'planet',
      longText: 'The planet have atmosphere',
      counter: 14
    }
  ]

  await entity.insert({
    inputs: posts
  })

  deepEqual(await entity.find({ where: { title: { like: '%at' } } }), [{
    id: '2',
    title: 'Cat',
    longText: 'The Cat meows',
    counter: 2
  }], 'where: { title: { like: \'%at\' } }')

  deepEqual(await entity.find({ where: { title: { like: '%at%' } } }), [{
    id: '2',
    title: 'Cat',
    longText: 'The Cat meows',
    counter: 2
  },
  {
    id: '3',
    title: 'Potato',
    longText: 'The Potato is vegetable',
    counter: 3
  },
  {
    id: '4',
    title: 'atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { title: { like: \'%at%\' } }')

  deepEqual(await entity.find({ where: { title: { like: 'at%' } } }), [{
    id: '4',
    title: 'atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { title: { like: \'at%\' } }')

  deepEqual(await entity.find({ where: { longText: { like: '%is%' } } }), [{
    id: '3',
    title: 'Potato',
    longText: 'The Potato is vegetable',
    counter: 3
  },
  {
    id: '4',
    title: 'atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { longText: { like: \'%is%\' } }')

  deepEqual(await entity.find({ where: { longText: { like: null } } }), [], 'where: { longText: { like: null } }')

  if (!isSQLite) {
    deepEqual(await entity.find({ where: { counter: { like: 4 } } }), [{
      id: '4',
      title: 'atmosphere',
      longText: 'The atmosphere is not a sphere',
      counter: 4
    }], 'where: { counter: { like: 4 } }')
  }

  deepEqual(await entity.find({ where: { counter: { like: '%4' } } }), [{
    id: '4',
    title: 'atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  },
  {
    id: '5',
    title: 'planet',
    longText: 'The planet have atmosphere',
    counter: 14
  }], 'where: { counter: { like: \'%4\' } }')

  deepEqual(await entity.find({ where: { counter: { like: '4%' } } }), [{
    id: '4',
    title: 'atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { counter: { like: \'4%\' } }')

  deepEqual(await entity.find({ where: { counter: { like: null } } }), [], 'where: { counter: { like: null } }')
})

test('ILIKE', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(() => db.dispose())
      ok('onDatabaseLoad called')

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

  const posts = [
    {
      title: 'Dog',
      longText: 'The Dog barks',
      counter: 1
    },
    {
      title: 'Cat',
      longText: 'The Cat meows',
      counter: 2
    },
    {
      title: 'Potato',
      longText: 'The Potato is vegetable',
      counter: 3
    },
    {
      title: 'Atmosphere',
      longText: 'The atmosphere is not a sphere',
      counter: 4
    },
    {
      title: 'planet',
      longText: 'The planet have atmosphere',
      counter: 14
    }
  ]

  await entity.insert({
    inputs: posts
  })

  deepEqual(await entity.find({ where: { title: { ilike: '%at' } } }), [{
    id: '2',
    title: 'Cat',
    longText: 'The Cat meows',
    counter: 2
  }], 'where: { title: { like: \'%at\' } }')

  deepEqual(await entity.find({ where: { title: { ilike: '%at%' } } }), [{
    id: '2',
    title: 'Cat',
    longText: 'The Cat meows',
    counter: 2
  },
  {
    id: '3',
    title: 'Potato',
    longText: 'The Potato is vegetable',
    counter: 3
  },
  {
    id: '4',
    title: 'Atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { title: { ilike: \'%at%\' } }')

  deepEqual(await entity.find({ where: { title: { ilike: 'at%' } } }), [{
    id: '4',
    title: 'Atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { title: { ilike: \'at%\' } }')

  deepEqual(await entity.find({ where: { longText: { ilike: '%is%' } } }), [{
    id: '3',
    title: 'Potato',
    longText: 'The Potato is vegetable',
    counter: 3
  },
  {
    id: '4',
    title: 'Atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { longText: { ilike: \'%is%\' } }')

  deepEqual(await entity.find({ where: { longText: { ilike: null } } }), [], 'where: { longText: { ilike: null } }')

  if (!isSQLite) {
    deepEqual(await entity.find({ where: { counter: { ilike: 4 } } }), [{
      id: '4',
      title: 'Atmosphere',
      longText: 'The atmosphere is not a sphere',
      counter: 4
    }], 'where: { counter: { ilike: 4 } }')
  }

  deepEqual(await entity.find({ where: { counter: { ilike: '%4' } } }), [{
    id: '4',
    title: 'Atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  },
  {
    id: '5',
    title: 'planet',
    longText: 'The planet have atmosphere',
    counter: 14
  }], 'where: { counter: { ilike: \'%4\' } }')

  deepEqual(await entity.find({ where: { counter: { ilike: '4%' } } }), [{
    id: '4',
    title: 'Atmosphere',
    longText: 'The atmosphere is not a sphere',
    counter: 4
  }], 'where: { counter: { ilike: \'4%\' } }')

  deepEqual(await entity.find({ where: { counter: { ilike: null } } }), [], 'where: { counter: { ilike: null } }')
})

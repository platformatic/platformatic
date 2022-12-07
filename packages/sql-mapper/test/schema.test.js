const { test } = require('tap')
const { connect } = require('..')

const { connInfo, isSQLite, isMysql, isMysql8, isPg, clear } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('uses tables from different schemas', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`users\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: ['test1', 'test2']
  })
  const pageEntity = mapper.entities.test1Page
  equal(pageEntity.name, 'Test1Page')
  equal(pageEntity.singularName, 'test1Page')
  equal(pageEntity.pluralName, 'test1Pages')
  equal(pageEntity.schema, 'test1')
  const userEntity = mapper.entities.test2User
  equal(userEntity.name, 'Test2User')
  equal(userEntity.singularName, 'test2User')
  equal(userEntity.pluralName, 'test2Users')
  equal(userEntity.schema, 'test2')
  pass()
})

test('find enums correctly using schemas', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`
      CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type ENUM ('blank', 'non-blank')
    );`)
    } else if (isPg) {
      await db.query(sql`
      CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type pagetype
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type ENUM ('blank', 'non-blank')
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: ['test1']
  })
  const pageEntity = mapper.entities.test1Page
  equal(pageEntity.name, 'Test1Page')
  equal(pageEntity.singularName, 'test1Page')
  equal(pageEntity.pluralName, 'test1Pages')
  pass()
})

test('if schema is empty array, should not load entities from tables in explicit schema', { skip: isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`users\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: []
  })

  equal(Object.keys(mapper.entities).length, 0)
  pass()
})

test('[pg] if schema is empty array, should find entities only in default \'public\' schema', { skip: !isPg }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: []
  })

  equal(Object.keys(mapper.entities).length, 1)
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  equal(pageEntity.schema, 'public')
  pass()
})

test('[sqlite] if sqllite, ignores schema information', { skip: !isSQLite }, async ({ pass, teardown, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())
    await db.query(sql`CREATE TABLE "pages" (
      "id" INTEGER PRIMARY KEY,
      "title" TEXT NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    schema: ['ignored', 'also_ignored']
  })

  equal(Object.keys(mapper.entities).length, 1)
  const pageEntity = mapper.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  equal(pageEntity.schema, null)
  pass()
})

test('addEntityHooks in entities with schema', { skip: isSQLite }, async ({ pass, teardown, same, equal, plan, fail, throws, end }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    }
  }

  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    onDatabaseLoad,
    schema: ['test1']
  })

  throws(() => mapper.addEntityHooks('user', {}), 'Cannot find entity user')

  mapper.addEntityHooks('test1Page', {
    noKey () {
      fail('noKey should never be called')
    },
    async save (original, { input, ctx, fields }) {
      pass('save  called')

      if (!input.id) {
        same(input, {
          title: 'Hello'
        })

        return original({
          input: {
            title: 'Hello from hook'
          },
          fields
        })
      } else {
        same(input, {
          id: 1,
          title: 'Hello World'
        })

        return original({
          input: {
            id: 1,
            title: 'Hello from hook 2'
          },
          fields
        })
      }
    },
    async find (original, args) {
      pass('find called')

      same(args.where, {
        id: {
          eq: '1'
        }
      })
      args.where = {
        id: {
          eq: '2'
        }
      }
      same(args.fields, ['id', 'title'])
      return original(args)
    },
    async insert (original, args) {
      pass('insert called')

      same(args.inputs, [{
        title: 'hello'
      }, {
        title: 'world'
      }])
      same(args.fields, ['id', 'title'])
      return original(args)
    }
  })

  const entity = mapper.entities.test1Page

  same(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  same(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  same(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
  end()
})

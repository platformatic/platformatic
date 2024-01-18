const { test } = require('node:test')
const { equal, ok, deepEqual, throws, ifError } = require('node:assert')
const { connect } = require('..')
const { match } = require('@platformatic/utils')

const { connInfo, isSQLite, isMysql, isMysql8, isPg, clear } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('uses tables from different schemas', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  ok(true)
})

test('find enums correctly using schemas', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
      DROP TYPE IF EXISTS pagetype CASCADE;
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
  ok(match(mapper.dbschema, [
    {
      schema: 'test1',
      table: 'pages',
      constraints: [
        {
          constraint_type: isMysql8 ? 'UNIQUE' : 'PRIMARY KEY'
        }
      ],
      columns: [
        {
          column_name: 'id',
          is_nullable: 'NO'
        },
        {
          column_name: 'title',
          is_nullable: 'NO'
        },
        {
          column_name: 'type',
          is_nullable: 'YES'
        }
      ]
    }
  ]))
  ok(true)
})

test('if schema is empty array, should not load entities from tables in explicit schema', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  ok(true)
})

test('[pg] if schema is empty array, should find entities only in default \'public\' schema', { skip: !isPg }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  ok(true)
})

test('[sqlite] if sqllite, ignores schema information', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
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
  ok(true)
})

test('addEntityHooks in entities with schema', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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

  throws(() => mapper.addEntityHooks('user', {}), { message: 'Cannot find entity user' })

  mapper.addEntityHooks('test1Page', {
    noKey () {
      ifError('noKey should never be called')
    },
    async save (original, { input, ctx, fields }) {
      ok('save  called')

      if (!input.id) {
        deepEqual(input, {
          title: 'Hello'
        })

        return original({
          input: {
            title: 'Hello from hook'
          },
          fields
        })
      } else {
        deepEqual(input, {
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
      ok('find called')

      deepEqual(args.where, {
        id: {
          eq: '1'
        }
      })
      args.where = {
        id: {
          eq: '2'
        }
      }
      deepEqual(args.fields, ['id', 'title'])
      return original(args)
    },
    async insert (original, args) {
      ok('insert called')

      deepEqual(args.inputs, [{
        title: 'hello'
      }, {
        title: 'world'
      }])
      deepEqual(args.fields, ['id', 'title'])
      return original(args)
    }
  })

  const entity = mapper.entities.test1Page

  deepEqual(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  deepEqual(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  deepEqual(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})

test('uses tables from different schemas with FK', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
      username VARCHAR(255) NOT NULL,
      page_id BIGINT UNSIGNED,
      FOREIGN KEY(page_id) REFERENCES test1.pages(id) ON DELETE CASCADE
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      page_id integer REFERENCES test1.pages(id)
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
  equal(pageEntity.relations.length, 0)

  const userEntity = mapper.entities.test2User
  equal(userEntity.name, 'Test2User')
  equal(userEntity.singularName, 'test2User')
  equal(userEntity.pluralName, 'test2Users')
  equal(userEntity.schema, 'test2')
  equal(userEntity.relations.length, 1)
  const userRelation = userEntity.relations[0]
  equal(userRelation.foreignEntityName, 'test1Page')
  equal(userRelation.entityName, 'test2User')
  ok(true)
})

test('recreate mapper from schema', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

    if (isMysql || isMysql8) {
      await db.query(sql`
      CREATE TABLE IF NOT EXISTS \`pages\` (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
    );`)
    } else if (isPg) {
      await db.query(sql`
      CREATE TABLE IF NOT EXISTS "pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else if (isSQLite) {
      await db.query(sql`
      CREATE TABLE IF NOT EXISTS "pages" (
      id INTEGER PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS "pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
    );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const dbschema = mapper.dbschema
  const knownQueries = [
    'SELECT VERSION()'
  ]
  const mapper2 = await connect({
    connectionString: connInfo.connectionString,
    log: {
      trace (msg) {
        if (knownQueries.indexOf(msg.query?.text) < 0) {
          console.log(msg)
          ifError('no trace')
        }
      },
      error (...msg) {
        console.log(...msg)
        ifError('no error')
      }
    },
    dbschema,
    ignore: {},
    hooks: {}
  })
  test.after(() => mapper2.db.dispose())

  const pageEntity = mapper2.entities.page
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  ok(true)
})

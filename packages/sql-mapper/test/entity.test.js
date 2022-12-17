'use strict'

const { test } = require('tap')

const { clear, connInfo, isSQLite, isMysql, isPg, isMysql8 } = require('./helper')
const { connect } = require('..')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('entity fields', async ({ equal, not, same, teardown }) => {
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
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  not(pageEntity, undefined)
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  same(pageEntity.primaryKeys, new Set(['id']))
  equal(pageEntity.table, 'pages')
  equal(pageEntity.camelCasedFields.id.primaryKey, true)
})

test('entity API', { only: true }, async ({ equal, same, teardown, rejects }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())
    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL
      );`)
    }
    await db.query(sql`INSERT INTO pages (the_title) VALUES ('foo')`)
    await db.query(sql`INSERT INTO pages (the_title) VALUES ('bar')`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  // fixInput
  const fixedInput = pageEntity.fixInput({ id: 42, theTitle: 'Fixme' })
  same(fixedInput, { id: 42, the_title: 'Fixme' })

  // fixOutput
  const fixedOutput = pageEntity.fixOutput({
    id: 42,
    the_title: 'Fixme'
  })

  same(fixedOutput, { id: 42, theTitle: 'Fixme' })

  // empty fixOutput
  same(pageEntity.fixOutput(undefined), undefined)

  // find
  const findResult = await pageEntity.find({ fields: ['theTitle'] })
  same(findResult, [{ theTitle: 'foo' }, { theTitle: 'bar' }])

  // count
  const countResult = await pageEntity.count({ fields: ['theTitle'] })
  same(countResult, 2)

  // insert - single
  const insertResult = await pageEntity.insert({
    inputs: [{ theTitle: 'foobar' }],
    fields: ['id', 'theTitle']
  })
  same(insertResult, [{ id: '3', theTitle: 'foobar' }])

  // insert - multiple
  const insertMultipleResult = await pageEntity.insert({
    inputs: [{ theTitle: 'platformatic' }, { theTitle: 'foobar' }],
    fields: ['id', 'theTitle']
  })
  same(insertMultipleResult, [{ id: '4', theTitle: 'platformatic' }, { id: '5', theTitle: 'foobar' }])

  // save - new record
  same(await pageEntity.save({
    input: { theTitle: 'fourth page' },
    fields: ['id', 'theTitle']
  }), { id: 6, theTitle: 'fourth page' })

  // save - update record
  same(await pageEntity.save({
    input: { id: 4, theTitle: 'foofoo' },
    fields: ['id', 'theTitle']
  }), { id: '4', theTitle: 'foofoo' })

  // save - empty object
  rejects(async () => {
    await pageEntity.save({})
  }, Error, 'Input not provided.')

  rejects(async () => {
    await pageEntity.save({ input: { fakeColumn: 'foobar' } })
  })
  // delete
  same(await pageEntity.delete({
    where: {
      id: {
        eq: 2
      }
    },
    fields: ['id', 'theTitle']
  }), [{ id: '2', theTitle: 'bar' }])
})

test('empty save', async ({ equal, same, teardown, rejects }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())
    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255)
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

  const insertResult = await mapper.entities.page.save({
    input: {},
    fields: ['id', 'theTitle']
  })
  same(insertResult, { id: '1', theTitle: null })
})

test('insert with explicit PK value', async ({ same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title varchar(255) NOT NULL
    );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  const [newPage] = await pageEntity.insert({
    fields: ['id', 'title'],
    inputs: [{ id: 13, title: '13th page with explicit id equal to 13' }]
  })
  same(newPage, {
    id: '13',
    title: '13th page with explicit id equal to 13'
  })
})

test('[SQLite] - UUID', { skip: !isSQLite }, async ({ pass, teardown, same, equal }) => {
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    ignore: {},
    hooks: {},
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE TABLE pages (
        id uuid PRIMARY KEY,
        title VARCHAR(42)
      );`)
    }
  })
  teardown(() => mapper.db.dispose())

  const pageEntity = mapper.entities.page

  let id
  {
    const res = await pageEntity.save({ input: { title: 'Hello' } })
    id = res.id
    same(res, {
      id,
      title: 'Hello'
    })
  }

  {
    const res = await pageEntity.find({ where: { id: { eq: id } } })
    same(res, [{
      id,
      title: 'Hello'
    }])
  }

  {
    const res = await pageEntity.save({ input: { id, title: 'Hello World' } })
    same(res, {
      id,
      title: 'Hello World'
    })
  }
})

test('[SQLite] throws if PK is not INTEGER', { skip: !isSQLite }, async ({ fail, equal, teardown, rejects }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    await db.query(sql`CREATE TABLE pages (
      id int PRIMARY KEY,
      title varchar(255) NOT NULL,
      content text NOT NULL
    );`)
  }
  try {
    await connect({
      connectionString: connInfo.connectionString,
      log: fakeLogger,
      onDatabaseLoad,
      ignore: {},
      hooks: {}
    })
    fail()
  } catch (err) {
    equal(err.message, 'Invalid Primary Key type. Expected "integer", found "int"')
  }
})

test('mixing snake and camel case', async ({ pass, teardown, same, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isMysql) {
      await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            body_content TEXT,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
    } else if (isSQLite) {
      await db.query(sql`
        CREATE TABLE "categories" (
          "id" INTEGER PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `)
      await db.query(sql`
        CREATE TABLE "pages" (
          "id" INTEGER PRIMARY KEY,
          "title" TEXT NOT NULL,
          "body_content" TEXT
        );
      `)
      await db.query(sql`
        ALTER TABLE "pages" ADD COLUMN "category_id" REFERENCES "categories"("id");
      `)
    } else {
      await db.query(sql`
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name varchar(255) NOT NULL
        );

        CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title varchar(255) NOT NULL,
          body_content text,
          category_id int NOT NULL REFERENCES categories(id)
        );
      `)
    }
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const pageEntity = mapper.entities.page
  const categoryEntity = mapper.entities.category

  const [newCategory] = await categoryEntity.insert({
    fields: ['id', 'name'],
    inputs: [{ name: 'fiction' }]
  })

  {
    const res = await pageEntity.insert({
      fields: ['id', 'title', 'categoryId'],
      inputs: [
        {
          title: 'A fiction', bodyContent: 'This is our first fiction', categoryId: newCategory.id
        },
        {
          title: 'A fiction', body_content: 'This is our first fiction', category_id: newCategory.id
        }

      ]
    })
    same(res, [{
      id: '1',
      title: 'A fiction',
      categoryId: newCategory.id
    }, {
      id: '2',
      title: 'A fiction',
      categoryId: newCategory.id
    }])
  }

  {
    const res = await pageEntity.save({
      fields: ['id', 'title', 'categoryId'],
      input: {
        title: 'A fiction', body_content: 'This is our first fiction', category_id: newCategory.id
      }
    })
    same(res, {
      id: '3',
      title: 'A fiction',
      categoryId: newCategory.id
    })
  }
})

test('only include wanted fields - with foreign', async ({ pass, teardown, same, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isMysql) {
      await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            body_content TEXT,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
    } else if (isSQLite) {
      await db.query(sql`
        CREATE TABLE "categories" (
          "id" INTEGER PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `)
      await db.query(sql`
        CREATE TABLE "pages" (
          "id" INTEGER PRIMARY KEY,
          "title" TEXT NOT NULL,
          "body_content" TEXT
        );
      `)
      await db.query(sql`
        ALTER TABLE "pages" ADD COLUMN "category_id" REFERENCES "categories"("id");
      `)
    } else {
      await db.query(sql`
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name varchar(255) NOT NULL
        );

        CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title varchar(255) NOT NULL,
          body_content text,
          category_id int NOT NULL REFERENCES categories(id)
        );
      `)
    }
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const pageEntity = mapper.entities.page
  const categoryEntity = mapper.entities.category

  const [newCategory] = await categoryEntity.insert({
    fields: ['id', 'name'],
    inputs: [{ name: 'fiction' }]
  })

  {
    const fields = ['id', 'category_id']
    const res = await pageEntity.insert({
      fields,
      inputs: [
        {
          title: 'A fiction', bodyContent: 'This is our first fiction', categoryId: newCategory.id
        }
      ]
    })
    same(res, [{
      id: '1',
      categoryId: newCategory.id
    }])
  }
})

test('only include wanted fields - without foreign', async ({ pass, teardown, same, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isMysql) {
      await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            body_content TEXT,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
    } else if (isSQLite) {
      await db.query(sql`
        CREATE TABLE "categories" (
          "id" INTEGER PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `)
      await db.query(sql`
        CREATE TABLE "pages" (
          "id" INTEGER PRIMARY KEY,
          "title" TEXT NOT NULL,
          "body_content" TEXT
        );
      `)
      await db.query(sql`
        ALTER TABLE "pages" ADD COLUMN "category_id" REFERENCES "categories"("id");
      `)
    } else {
      await db.query(sql`
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name varchar(255) NOT NULL
        );

        CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title varchar(255) NOT NULL,
          body_content text,
          category_id int NOT NULL REFERENCES categories(id)
        );
      `)
    }
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const pageEntity = mapper.entities.page
  const categoryEntity = mapper.entities.category

  const [newCategory] = await categoryEntity.insert({
    fields: ['id', 'name'],
    inputs: [{ name: 'fiction' }]
  })

  {
    const fields = ['id', 'title']
    const res = await pageEntity.insert({
      fields,
      inputs: [
        {
          title: 'A fiction', bodyContent: 'This is our first fiction', categoryId: newCategory.id
        }
      ]
    })
    same(res, [{
      id: '1',
      title: 'A fiction'
    }])
  }
})

test('include all fields', async ({ pass, teardown, same, equal }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isMysql) {
      await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            body_content TEXT,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
    } else if (isSQLite) {
      await db.query(sql`
        CREATE TABLE "categories" (
          "id" INTEGER PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `)
      await db.query(sql`
        CREATE TABLE "pages" (
          "id" INTEGER PRIMARY KEY,
          "title" TEXT NOT NULL,
          "body_content" TEXT
        );
      `)
      await db.query(sql`
        ALTER TABLE "pages" ADD COLUMN "category_id" REFERENCES "categories"("id");
      `)
    } else {
      await db.query(sql`
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name varchar(255) NOT NULL
        );

        CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title varchar(255) NOT NULL,
          body_content text,
          category_id int NOT NULL REFERENCES categories(id)
        );
      `)
    }
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const pageEntity = mapper.entities.page
  const categoryEntity = mapper.entities.category

  const [newCategory] = await categoryEntity.insert({
    fields: ['id', 'name'],
    inputs: [{ name: 'fiction' }]
  })

  {
    const res = await pageEntity.insert({
      inputs: [
        {
          title: 'A fiction', bodyContent: 'This is our first fiction', categoryId: newCategory.id
        }
      ]
    })
    same(res, [{
      id: '1',
      title: 'A fiction',
      bodyContent: 'This is our first fiction',
      categoryId: newCategory.id
    }])
  }
})

test('include possible values of enum columns', { skip: isSQLite }, async ({ same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isPg) {
      await db.query(sql`
      CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42),
        type pagetype
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42),
        type ENUM ('blank', 'non-blank')
      );
      `)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  const typeField = pageEntity.fields.type
  same(typeField.enum, ['blank', 'non-blank'])
})

test('JSON type', { skip: !(isPg || isMysql8) }, async ({ teardown, same, equal, pass }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE simple_types (
        id SERIAL PRIMARY KEY,
        config json NOT NULL
      );`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const simpleType = mapper.entities.simpleType

  // save - new record
  same(await simpleType.save({
    input: { config: { foo: 'bar' } }
  }), { id: 1, config: { foo: 'bar' } })

  // save - update
  same(await simpleType.save({
    input: { id: 1, config: { foo: 'bar', bar: 'foo' } }
  }), { id: 1, config: { foo: 'bar', bar: 'foo' } })

  // insert
  same(await simpleType.insert({
    inputs: [{ config: { foo: 'bar' } }]
  }), [{ id: 2, config: { foo: 'bar' } }])

  // updateMany
  same(await simpleType.updateMany({
    where: {
      id: {
        eq: 2
      }
    },
    input: {
      config: {
        foo: 'bar',
        bar: 'foo'
      }
    }
  }), [{ id: 2, config: { foo: 'bar', bar: 'foo' } }])
})

test('stored and virtual generated columns should return for SQLite', { skip: !(isSQLite) }, async ({ teardown, same }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE generated_test (
      id INTEGER PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED,
      test_virtual INTEGER GENERATED ALWAYS AS (test*4) VIRTUAL
    );`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const generatedTest = mapper.entities.generatedTest

  // save - new record
  same(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2, testVirtual: 4 })

  // save - update
  same(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4, testVirtual: 8 })

  // insert
  same(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8, testVirtual: 16 }])

  // updateMany
  same(await generatedTest.updateMany({
    where: {
      id: {
        eq: 2
      }
    },
    input: {
      test: 8
    }
  }), [{ id: 2, test: 8, testStored: 16, testVirtual: 32 }])
})

test('stored generated columns should return for pg', { skip: !(isPg) }, async ({ teardown, same }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE generated_test (
      id SERIAL PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED
    );`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const generatedTest = mapper.entities.generatedTest

  // save - new record
  same(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2 })

  // save - update
  same(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4 })

  // insert
  same(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8 }])

  // updateMany
  same(await generatedTest.updateMany({
    where: {
      id: {
        eq: 2
      }
    },
    input: {
      test: 8
    }
  }), [{ id: 2, test: 8, testStored: 16 }])
})

test('stored and virtual generated columns should return for pg', { skip: (isPg || isSQLite) }, async ({ teardown, same }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    await db.query(sql`CREATE TABLE generated_test (
      id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED,
      test_virtual INTEGER GENERATED ALWAYS AS (test*4) VIRTUAL
    );`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  const generatedTest = mapper.entities.generatedTest

  // save - new record
  same(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2, testVirtual: 4 })

  // save - update
  same(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4, testVirtual: 8 })

  // insert
  same(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8, testVirtual: 16 }])

  // updateMany
  same(await generatedTest.updateMany({
    where: {
      id: {
        eq: 2
      }
    },
    input: {
      test: 8
    }
  }), [{ id: 2, test: 8, testStored: 16, testVirtual: 32 }])
})

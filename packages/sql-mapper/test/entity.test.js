'use strict'

const { test } = require('node:test')
const { equal, deepEqual, notEqual, rejects, ok } = require('node:assert')
const { clear, connInfo, isSQLite, isMysql, isPg, isMysql8 } = require('./helper')
const { connect } = require('..')
const fakeLogger = {
  // trace: (...args) => { console.log(JSON.stringify(args, null, 2)) },
  trace: () => {},
  error: () => {}
}

test('entity fields', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  notEqual(pageEntity, undefined)
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  deepEqual(pageEntity.primaryKeys, new Set(['id']))
  equal(pageEntity.table, 'pages')
  equal(pageEntity.camelCasedFields.id.primaryKey, true)
})

test('entity API', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42),
        is_published BOOLEAN NOT NULL
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL,
        is_published BOOLEAN NOT NULL
      );`)
    }
    await db.query(sql`INSERT INTO pages (the_title, is_published) VALUES ('foo', true)`)
    await db.query(sql`INSERT INTO pages (the_title, is_published) VALUES ('bar', false)`)
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
  const fixedInput = pageEntity.fixInput({ id: 42, theTitle: 'Fixme', isPublished: true })
  deepEqual(fixedInput, { id: 42, the_title: 'Fixme', is_published: true })

  // fixOutput
  const fixedOutput = pageEntity.fixOutput({
    id: 42,
    the_title: 'Fixme',
    is_published: true
  })

  deepEqual(fixedOutput, { id: 42, theTitle: 'Fixme', isPublished: true })

  // empty fixOutput
  deepEqual(pageEntity.fixOutput(undefined), undefined)

  // find
  const findResult = await pageEntity.find({ fields: ['theTitle'] })
  deepEqual(findResult, [{ theTitle: 'foo' }, { theTitle: 'bar' }])

  // count
  const countResult = await pageEntity.count({ fields: ['theTitle'] })
  deepEqual(countResult, 2)

  // insert - single
  const insertResult = await pageEntity.insert({
    inputs: [{ theTitle: 'foobar', isPublished: false }],
    fields: ['id', 'theTitle', 'isPublished']
  })
  deepEqual(insertResult, [{ id: '3', theTitle: 'foobar', isPublished: false }])

  // insert - multiple
  const insertMultipleResult = await pageEntity.insert({
    inputs: [
      { theTitle: 'platformatic', isPublished: false },
      { theTitle: 'foobar', isPublished: true }
    ],
    fields: ['id', 'theTitle', 'isPublished']
  })
  deepEqual(insertMultipleResult, [
    { id: '4', theTitle: 'platformatic', isPublished: false },
    { id: '5', theTitle: 'foobar', isPublished: true }
  ])

  // save - new record
  deepEqual(await pageEntity.save({
    input: { theTitle: 'fourth page', isPublished: false },
    fields: ['id', 'theTitle', 'isPublished']
  }), { id: 6, theTitle: 'fourth page', isPublished: false })

  // save - update record
  deepEqual(await pageEntity.save({
    input: { id: 4, theTitle: 'foofoo', isPublished: true },
    fields: ['id', 'theTitle', 'isPublished']
  }), { id: '4', theTitle: 'foofoo', isPublished: true })

  // save - empty object
  rejects(async () => {
    await pageEntity.save({})
  }, Error, 'Input not provided.')

  rejects(async () => {
    await pageEntity.save({ input: { fakeColumn: 'foobar' } })
  })
  // delete
  deepEqual(await pageEntity.delete({
    where: {
      id: {
        eq: 2
      }
    },
    fields: ['id', 'theTitle']
  }), [{ id: '2', theTitle: 'bar' }])
})

test('empty save', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
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
  deepEqual(insertResult, { id: '1', theTitle: null })
})

test('insert with explicit integer PK value', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
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
  deepEqual(newPage, {
    id: '13',
    title: '13th page with explicit id equal to 13'
  })
})

test('insert with explicit uuid PK value', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
    await db.query(sql`CREATE TABLE pages (
      id uuid PRIMARY KEY,
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
    inputs: [{
      id: '00000000-0000-0000-0000-000000000013',
      title: '13th page with explicit id equal to 13'
    }]
  })
  deepEqual(newPage, {
    id: '00000000-0000-0000-0000-000000000013',
    title: '13th page with explicit id equal to 13'
  })
})

test('insert with explicit uuid PK value without rowid', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
    await db.query(sql`CREATE TABLE pages (
      id uuid PRIMARY KEY,
      title varchar(255) NOT NULL
    ) WITHOUT ROWID;`)
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
    inputs: [{
      id: '00000000-0000-0000-0000-000000000013',
      title: '13th page with explicit id equal to 13'
    }]
  })
  deepEqual(newPage, {
    id: '00000000-0000-0000-0000-000000000013',
    title: '13th page with explicit id equal to 13'
  })
})

test('insert without fields to retrieve', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
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
  await pageEntity.insert({
    fields: [],
    inputs: [{
      id: '13',
      title: '13th page with explicit id equal to 13'
    }]
  })

  const [newPage] = await pageEntity.find({
    where: {
      id: {
        eq: '13'
      }
    }
  })

  deepEqual(newPage, {
    id: '13',
    title: '13th page with explicit id equal to 13'
  })
})

test('[SQLite] - UUID', { skip: !isSQLite }, async () => {
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    ignore: {},
    hooks: {},
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE TABLE pages (
        id uuid PRIMARY KEY,
        title VARCHAR(42)
      );`)
    }
  })
  test.after(() => mapper.db.dispose())

  const pageEntity = mapper.entities.page

  let id
  {
    const res = await pageEntity.save({ input: { title: 'Hello' } })
    id = res.id
    deepEqual(res, {
      id,
      title: 'Hello'
    })
  }

  {
    const res = await pageEntity.find({ where: { id: { eq: id } } })
    deepEqual(res, [{
      id,
      title: 'Hello'
    }])
  }

  {
    const res = await pageEntity.save({ input: { id, title: 'Hello World' } })
    deepEqual(res, {
      id,
      title: 'Hello World'
    })
  }
})

test('[SQLite] allows to have VARCHAR PK', { skip: !isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

    await db.query(sql`CREATE TABLE pages (
      id varchar(255) PRIMARY KEY,
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
    inputs: [{ id: 'varchar_id', title: '13th page with explicit id equal to 13' }]
  })
  deepEqual(newPage, {
    id: 'varchar_id',
    title: '13th page with explicit id equal to 13'
  })
})

test('mixing snake and camel case', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
    deepEqual(res, [{
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
    deepEqual(res, {
      id: '3',
      title: 'A fiction',
      categoryId: newCategory.id
    })
  }
})

test('only include wanted fields - with foreign', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
    deepEqual(res, [{
      id: '1',
      categoryId: newCategory.id
    }])
  }
})

test('only include wanted fields - without foreign', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
    deepEqual(res, [{
      id: '1',
      title: 'A fiction'
    }])
  }
})

test('include all fields', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
    deepEqual(res, [{
      id: '1',
      title: 'A fiction',
      bodyContent: 'This is our first fiction',
      categoryId: newCategory.id
    }])
  }
})

test('include possible values of enum columns', { skip: isSQLite }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  deepEqual(typeField.enum, ['blank', 'non-blank'])
})

test('JSON type', { skip: !(isPg || isMysql8) }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  deepEqual(await simpleType.save({
    input: { config: { foo: 'bar' } }
  }), { id: 1, config: { foo: 'bar' } })

  // save - update
  deepEqual(await simpleType.save({
    input: { id: 1, config: { foo: 'bar', bar: 'foo' } }
  }), { id: 1, config: { foo: 'bar', bar: 'foo' } })

  // insert
  deepEqual(await simpleType.insert({
    inputs: [{ config: { foo: 'bar' } }]
  }), [{ id: 2, config: { foo: 'bar' } }])

  // updateMany
  deepEqual(await simpleType.updateMany({
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

test('stored and virtual generated columns should return for SQLite', { skip: !(isSQLite) }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  deepEqual(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2, testVirtual: 4 })

  // save - update
  deepEqual(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4, testVirtual: 8 })

  // insert
  deepEqual(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8, testVirtual: 16 }])

  // updateMany
  deepEqual(await generatedTest.updateMany({
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

test('stored generated columns should return for pg', { skip: !(isPg) }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  deepEqual(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2 })

  // save - update
  deepEqual(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4 })

  // insert
  deepEqual(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8 }])

  // updateMany
  deepEqual(await generatedTest.updateMany({
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

test('stored and virtual generated columns should return for pg', { skip: (isPg || isSQLite) }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

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
  deepEqual(await generatedTest.save({
    input: { test: 1 }
  }), { id: 1, test: 1, testStored: 2, testVirtual: 4 })

  // save - update
  deepEqual(await generatedTest.save({
    input: { id: 1, test: 2 }
  }), { id: 1, test: 2, testStored: 4, testVirtual: 8 })

  // insert
  deepEqual(await generatedTest.insert({
    inputs: [{ test: 4 }]
  }), [{ id: 2, test: 4, testStored: 8, testVirtual: 16 }])

  // updateMany
  deepEqual(await generatedTest.updateMany({
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

test('nested transactions', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })
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

  await mapper.db.tx(async (tx) => {
    const insertResult = await mapper.entities.page.save({
      input: {},
      fields: ['id', 'theTitle'],
      tx
    })
    deepEqual(insertResult, { id: '1', theTitle: null })
  })
})

test('array support (PG)', { skip: !(isPg) }, async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

    await db.query(sql`CREATE TABLE generated_test (
      id SERIAL PRIMARY KEY,
      checkmark BOOLEAN NOT NULL DEFAULT true,
      test INTEGER[]
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
  deepEqual(await generatedTest.save({
    input: { test: [1, 2, 3], checkmark: true }
  }), { id: 1, test: [1, 2, 3], checkmark: true })

  // save - update
  deepEqual(await generatedTest.save({
    input: { id: 1, test: [4, 5, 6], checkmark: true }
  }), { id: 1, test: [4, 5, 6], checkmark: true })

  // insert
  deepEqual(await generatedTest.insert({
    inputs: [{ test: [4], checkmark: true }]
  }), [{ id: 2, test: [4], checkmark: true }])

  // where any
  deepEqual(await generatedTest.find({
    where: {
      test: { any: 4 }
    }
  }), [{ id: 1, test: [4, 5, 6], checkmark: true }, { id: 2, test: [4], checkmark: true }])

  // where all
  deepEqual(await generatedTest.find({
    where: {
      test: { all: 4 }
    }
  }), [{ id: 2, test: [4], checkmark: true }])

  // where contains
  deepEqual(await generatedTest.find({
    where: {
      test: { contains: [4] }
    }
  }), [{ id: 1, test: [4, 5, 6], checkmark: true }, { id: 2, test: [4], checkmark: true }])

  // where contained
  deepEqual(await generatedTest.find({
    where: {
      test: { contained: [4, 5, 6] }
    }
  }), [{ id: 1, test: [4, 5, 6], checkmark: true }, { id: 2, test: [4], checkmark: true }])

  // where overlaps
  deepEqual(await generatedTest.find({
    where: {
      test: { overlaps: [4] }
    }
  }), [{ id: 1, test: [4, 5, 6], checkmark: true }, { id: 2, test: [4], checkmark: true }])

  // where eq
  await rejects(generatedTest.find({
    where: {
      test: { eq: 4 }
    }
  }))

  // where any to non-array
  await rejects(generatedTest.find({
    where: {
      checkmark: { any: 4 }
    }
  }))

  // where any to non-array
  await rejects(generatedTest.find({
    where: {
      checkmark: { all: 4 }
    }
  }))

  // updateMany
  deepEqual(await generatedTest.updateMany({
    where: {
      checkmark: { eq: true }
    },
    input: {
      test: [8]
    }
  }), [{ id: 1, test: [8], checkmark: true }, { id: 2, test: [8], checkmark: true }])
})

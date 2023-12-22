'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { setTimeout } = require('timers/promises')

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

test('inserted_at updated_at happy path', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: {
      createdAt: 'inserted_at',
      updatedAt: 'updated_at'
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  let original

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.insertedAt, null, 'insertedAt')
    not(data.savePage.updatedAt, null, 'updatedAt')
    comment(`insertedAt: ${data.savePage.insertedAt}`)
    comment(`updatedAt: ${data.savePage.updatedAt}`)
    original = data.savePage
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.insertedAt, original.insertedAt, 'insertedAt')
    equal(data.getPageById.updatedAt, original.updatedAt, 'updatedAt')
    comment(`insertedAt: ${data.getPageById.insertedAt}`)
    comment(`updatedAt: ${data.getPageById.updatedAt}`)
  }

  await setTimeout(1000) // await 1s

  let updated
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    const data = res.json().data
    equal(data.savePage.insertedAt, original.insertedAt, 'insertedAt')
    not(data.savePage.updatedAt, original.updatedAt, 'updatedAt')
    updated = data.savePage
    comment(`insertedAt: ${data.savePage.insertedAt}`)
    comment(`updatedAt: ${data.savePage.updatedAt}`)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.insertedAt, updated.insertedAt, 'insertedAt')
    equal(data.getPageById.updatedAt, updated.updatedAt, 'updatedAt')
    comment(`insertedAt: ${data.getPageById.insertedAt}`)
    comment(`updatedAt: ${data.getPageById.updatedAt}`)
  }
})

test('cannot set inserted_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: {
      createdAt: 'inserted_at',
      updatedAt: 'updated_at'
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", insertedAt: "${new Date().toISOString()}" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'savePage status code')
    const data = res.json()
    equal(data.errors[0].message, 'Field "insertedAt" is not defined by type "PageInput".')
  }
})

test('cannot set updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: {
      createdAt: 'inserted_at',
      updatedAt: 'updated_at'
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.insertedAt, null, 'insertedAt')
    not(data.savePage.updatedAt, null, 'updatedAt')
    comment(`insertedAt: ${data.savePage.insertedAt}`)
    comment(`updatedAt: ${data.savePage.updatedAt}`)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World", updatedAt: "${new Date().toISOString()}" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'savePage status code')
    const data = res.json()
    equal(data.errors[0].message, 'Field "updatedAt" is not defined by type "PageInput".')
  }
})

test('do not assign inserted_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: false,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    equal(data.savePage.insertedAt, null, 'insertedAt')
    equal(data.savePage.updatedAt, null, 'updatedAt')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.insertedAt, null, 'insertedAt')
    equal(data.getPageById.updatedAt, null, 'updatedAt')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    const data = res.json().data
    equal(data.savePage.insertedAt, null, 'insertedAt')
    equal(data.savePage.updatedAt, null, 'updatedAt')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.insertedAt, null, 'insertedAt')
    equal(data.getPageById.updatedAt, null, 'updatedAt')
  }
})

test('bulk insert adds inserted_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: {
      createdAt: 'inserted_at',
      updatedAt: 'updated_at'
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.insertedAt, null, 'insertedAt')
    not(data.savePage.updatedAt, null, 'updatedAt')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1' },
            { title: 'Page 2' },
            { title: 'Page 3' }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const pages = res.json().data.insertPages
    for (const page of pages) {
      not(page.insertedAt, null, 'insertedAt')
      not(page.updatedAt, null, 'updatedAt')
      equal(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pages {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const pages = res.json().data.pages
    for (const page of pages) {
      not(page.insertedAt, null, 'insertedAt')
      not(page.updatedAt, null, 'updatedAt')
      equal(page.insertedAt, page.updatedAt, 'insertedAt === updatedAt')
    }
  }
})

test('bulk insert with autoTimestamp=false do not had inserted_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    autoTimestamp: false,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
              insertedAt
              updatedAt
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1' },
            { title: 'Page 2' },
            { title: 'Page 3' }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const pages = res.json().data.insertPages
    for (const page of pages) {
      equal(page.insertedAt, null, 'insertedAt')
      equal(page.updatedAt, null, 'updatedAt')
    }
  }
})

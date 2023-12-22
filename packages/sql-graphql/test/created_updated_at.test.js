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
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );`)
  } else if (isMysql) {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      created_at TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP NULL DEFAULT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );`)
  }
}

test('created_at updated_at happy path', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.createdAt, null, 'createdAt')
    not(data.savePage.updatedAt, null, 'updatedAt')
    comment(`createdAt: ${data.savePage.createdAt}`)
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.createdAt, original.createdAt, 'createdAt')
    equal(data.getPageById.updatedAt, original.updatedAt, 'updatedAt')
    comment(`createdAt: ${data.getPageById.createdAt}`)
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    const data = res.json().data
    equal(data.savePage.createdAt, original.createdAt, 'createdAt')
    not(data.savePage.updatedAt, original.updatedAt, 'updatedAt')
    updated = data.savePage
    comment(`createdAt: ${data.savePage.createdAt}`)
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.createdAt, updated.createdAt, 'createdAt')
    equal(data.getPageById.updatedAt, updated.updatedAt, 'updatedAt')
    comment(`createdAt: ${data.getPageById.createdAt}`)
    comment(`updatedAt: ${data.getPageById.updatedAt}`)
  }
})

test('cannot set created_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
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
            savePage(input: { title: "Hello", createdAt: "${new Date().toISOString()}" }) {
              id
              title
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'savePage status code')
    const data = res.json()
    equal(data.errors[0].message, 'Field "createdAt" is not defined by type "PageInput".')
  }
})

test('cannot set updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.createdAt, null, 'createdAt')
    not(data.savePage.updatedAt, null, 'updatedAt')
    comment(`createdAt: ${data.savePage.createdAt}`)
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
              createdAt
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

test('do not assign created_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    equal(data.savePage.createdAt, null, 'createdAt')
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.createdAt, null, 'createdAt')
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    const data = res.json().data
    equal(data.savePage.createdAt, null, 'createdAt')
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const data = res.json().data
    equal(data.getPageById.createdAt, null, 'createdAt')
    equal(data.getPageById.updatedAt, null, 'updatedAt')
  }
})

test('bulk insert adds created_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    const data = res.json().data
    not(data.savePage.createdAt, null, 'createdAt')
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
              createdAt
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
      not(page.createdAt, null, 'createdAt')
      not(page.updatedAt, null, 'updatedAt')
      equal(page.createdAt, page.updatedAt, 'createdAt === updatedAt')
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
              createdAt
              updatedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    const pages = res.json().data.pages
    for (const page of pages) {
      not(page.createdAt, null, 'createdAt')
      not(page.updatedAt, null, 'updatedAt')
      equal(page.createdAt, page.updatedAt, 'createdAt === updatedAt')
    }
  }
})

test('bulk insert with autoTimestamp=false do not had created_at updated_at', async ({ pass, teardown, same, equal, not, comment }) => {
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
              createdAt
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
      equal(page.createdAt, null, 'createdAt')
      equal(page.updatedAt, null, 'updatedAt')
    }
  }
})

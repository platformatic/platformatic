'use strict'

const { clear, connInfo, isSQLite } = require('./helper')
const { test } = require('tap')
const Fastify = require('fastify')
const WebSocket = require('ws')
const { once } = require('events')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlEvents = require('@platformatic/sql-events')
const stream = require('stream')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      page_id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      page_id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
  }
}

function createWebSocketClient (t, app) {
  const ws = new WebSocket('ws://localhost:' + (app.server.address()).port + '/graphql', 'graphql-ws')
  const client = WebSocket.createWebSocketStream(ws, { encoding: 'utf8', objectMode: true })
  t.teardown(client.destroy.bind(client))
  client.setEncoding('utf8')
  return { client, ws }
}

test('subscription - crud when there is a primary key to be camelised', async t => {
  const app = Fastify()
  t.teardown(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlEvents)
  app.register(sqlGraphQL)

  await app.listen({ port: 0 })

  const { client } = createWebSocketClient(t, app)

  client.write(JSON.stringify({
    type: 'connection_init'
  }))

  {
    const query = `subscription {
      pageSaved {
        pageId
        title
      }
    }`
    client.write(JSON.stringify({
      pageId: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const query = `subscription {
      pageDeleted {
        pageId
      }
    }`
    client.write(JSON.stringify({
      pageId: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.type, 'connection_ack')
  }

  t.comment('sending mutation')

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          savePage(input: { title: "Hello World" }) {
            pageId
          }
        }
      `
    }
  })

  t.comment('mutation sent')

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.same(data, {
      type: 'data',
      payload: {
        data: {
          pageSaved: {
            pageId: '1',
            title: 'Hello World'
          }
        }
      }
    })
  }

  t.comment('updating entity')

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          savePage(input: { pageId: 1, title: "Il libraccio" }) {
            pageId
          }
        }
      `
    }
  })

  t.comment('entity updated')

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.same(data, {
      type: 'data',
      payload: {
        data: {
          pageSaved: {
            pageId: '1',
            title: 'Il libraccio'
          }
        }
      }
    })
  }

  t.comment('deleting entity')

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          deletePages(where: { pageId: { eq: 1 } }) {
            pageId
          }
        }
      `
    }
  })

  t.comment('entity deleted')

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.same(data, {
      type: 'data',
      payload: {
        data: {
          pageDeleted: {
            pageId: '1'
          }
        }
      }
    })
  }

  t.comment('sending mutation')

  {
    const [
      received,
      stored
    ] = await Promise.all(([
      (async function () {
        const res = await app.inject({
          method: 'POST',
          url: '/graphql',
          body: {
            query: `
            mutation batch($inputs : [PageInput]!) {
              insertPages (inputs: $inputs) {
                pageId
                title
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
        t.comment('mutation sent')
        const pages = res.json().data.insertPages
        t.comment(JSON.stringify(pages, null, 2))
        return pages
      })(),
      (async function () {
        const pages = []
        const second = new stream.PassThrough({ objectMode: true })
        client.pipe(second)
        for await (const chunk of second) {
          const data = JSON.parse(chunk)
          pages.push(data.payload.data.pageSaved)
          if (pages.length === 3) {
            break
          }
        }
        t.comment('received all pages', JSON.stringify(pages, null, 2))
        return pages
      })()
    ]))

    t.same(received, stored)
  }
})

test('subscription - crud with a primary key to be camelised, two schemas and a ignore', async t => {
  const app = Fastify()
  t.teardown(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE categories (
          category_id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE categories (
          category_id SERIAL PRIMARY KEY,
          name VARCHAR(42)
        );`)
      }
    }
  })
  app.register(sqlEvents)
  app.register(sqlGraphQL, {
    subscriptionIgnore: ['category']
  })

  await app.listen({ port: 0 })

  const { client } = createWebSocketClient(t, app)
  t.teardown(() => client.destroy())

  client.write(JSON.stringify({
    type: 'connection_init'
  }))

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.type, 'connection_ack')
  }

  {
    const query = `subscription {
      categorySaved {
        categoryId
      }
    }`
    client.write(JSON.stringify({
      categoryId: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.payload, 'The subscription field "categorySaved" is not defined.')
  }
})

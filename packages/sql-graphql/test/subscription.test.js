import sqlEvents from '@platformatic/sql-events'
import sqlMapper from '@platformatic/sql-mapper'
import { once } from 'events'
import Fastify from 'fastify'
import { printSchema } from 'graphql'
import { equal, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import { PassThrough } from 'stream'
import WebSocket, { createWebSocketStream } from 'ws'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
  }
}

function createWebSocketClient (t, app) {
  const ws = new WebSocket('ws://localhost:' + app.server.address().port + '/graphql', 'graphql-ws')
  const client = createWebSocketStream(ws, { encoding: 'utf8', objectMode: true })
  t.after(() => client.destroy())
  client.setEncoding('utf8')
  return { client, ws }
}

test('subscription - crud', async t => {
  const app = Fastify()
  t.after(() => app.close())

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

  client.write(
    JSON.stringify({
      type: 'connection_init'
    })
  )

  {
    const query = `subscription {
      pageSaved {
        id
        title
      }
    }`
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query
        }
      })
    )
  }

  {
    const query = `subscription {
      pageDeleted {
        id
      }
    }`
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query
        }
      })
    )
  }

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    equal(data.type, 'connection_ack')
  }

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          savePage(input: { title: "Hello World" }) {
            id
          }
        }
      `
    }
  })

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    same(data, {
      id: 1,
      type: 'data',
      payload: {
        data: {
          pageSaved: {
            id: '1',
            title: 'Hello World'
          }
        }
      }
    })
  }

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          savePage(input: { id: 1, title: "Harry Potter" }) {
            id
          }
        }
      `
    }
  })

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    same(data, {
      id: 1,
      type: 'data',
      payload: {
        data: {
          pageSaved: {
            id: '1',
            title: 'Harry Potter'
          }
        }
      }
    })
  }

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        mutation {
          deletePages(where: { id: { eq: 1 } }) {
            id
          }
        }
      `
    }
  })

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    same(data, {
      id: '1',
      type: 'data',
      payload: {
        data: {
          pageDeleted: {
            id: '1'
          }
        }
      }
    })
  }

  {
    const [received, stored] = await Promise.all([
      (async function () {
        const res = await app.inject({
          method: 'POST',
          url: '/graphql',
          body: {
            query: `
            mutation batch($inputs : [PageInput]!) {
              insertPages (inputs: $inputs) {
                id
                title
              }
            }
          `,
            variables: {
              inputs: [{ title: 'Page 1' }, { title: 'Page 2' }, { title: 'Page 3' }]
            }
          }
        })

        const pages = res.json().data.insertPages

        return pages
      })(),
      (async function () {
        const pages = []
        const second = new PassThrough({ objectMode: true })
        client.pipe(second)
        for await (const chunk of second) {
          const data = JSON.parse(chunk)
          pages.push(data.payload.data.pageSaved)
          if (pages.length === 3) {
            break
          }
        }

        return pages
      })()
    ])

    same(received, stored)
  }
})

test('subscription - ignore', async t => {
  const app = Fastify()
  t.after(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlEvents)
  app.register(sqlGraphQL, {
    subscriptionIgnore: ['page']
  })

  await app.ready()
  equal(printSchema(app.graphql.schema).indexOf('type Subscription'), -1)
})

test('subscription - crud with two schemas and a ignore', async t => {
  const app = Fastify()
  t.after(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
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
  t.after(() => client.destroy())

  client.write(
    JSON.stringify({
      type: 'connection_init'
    })
  )

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    equal(data.type, 'connection_ack')
  }

  {
    const query = `subscription {
      categorySaved {
        id
      }
    }`
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query
        }
      })
    )
  }

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    same(data.payload, [
      {
        message: 'The subscription field "categorySaved" is not defined.',
        locations: [{ line: 2, column: 7 }]
      }
    ])
  }
})

'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const WebSocket = require('ws')
const { once } = require('events')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlEvents = require('@platformatic/sql-events')
const { clear, connInfo, isSQLite } = require('./helper')
const stream = require('stream')

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
  const ws = new WebSocket('ws://localhost:' + (app.server.address()).port + '/graphql', 'graphql-ws')
  const client = WebSocket.createWebSocketStream(ws, { encoding: 'utf8', objectMode: true })
  t.teardown(client.destroy.bind(client))
  client.setEncoding('utf8')
  return { client, ws }
}

test('subscription - crud', async t => {
  const app = Fastify({
    logger: {
      level: 'trace'
    }
  })
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
      pageCreated {
        id
        title
      }
    }`
    client.write(JSON.stringify({
      id: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const query = `subscription {
      pageUpdated {
        id
        title
      }
    }`
    client.write(JSON.stringify({
      id: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const query = `subscription {
      pageDeleted {
        id
        title
      }
    }`
    client.write(JSON.stringify({
      id: 1,
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
            id
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
      id: 1,
      type: 'data',
      payload: {
        data: {
          pageCreated: {
            id: '1',
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
          savePage(input: { id: 1, title: "Harry Potter" }) {
            id
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
      id: 1,
      type: 'data',
      payload: {
        data: {
          pageUpdated: {
            id: '1',
            title: 'Harry Potter'
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
          deletePages(where: { id: { eq: 1 } }) {
            id
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
      id: '1',
      type: 'data',
      payload: {
        data: {
          pageDeleted: {
            id: '1',
            title: 'Harry Potter'
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
                id
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
          console.log('received', chunk.toString())
          const data = JSON.parse(chunk)
          console.log('parsed', data)
          pages.push(data.payload.data.pageCreated)
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

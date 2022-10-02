'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const WebSocket = require('ws')
const { once } = require('events')
const { GraphQLSchema, parse } = require('graphql')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlEvents = require('@platformatic/sql-events')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { setTimeout } = require('timers/promises')

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

test('subscription - automatically creation', async t => {
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

  const query = `subscription {
    pageCreated {
      id
      title
    }
  }`

  client.write(JSON.stringify({
    type: 'connection_init'
  }))
  client.write(JSON.stringify({
    id: 1,
    type: 'start',
    payload: {
      query
    }
  }))

  {
    const [chunk] = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.type, 'connection_ack')
  }

  t.comment('sending mutation')
  await setTimeout(1000)

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
})

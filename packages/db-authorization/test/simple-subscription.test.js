'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
const auth = require('..')
const WebSocket = require('ws')
const { once } = require('events')
const { PassThrough } = require('stream')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  }
}

function createWebSocketClient (app) {
  const ws = new WebSocket('ws://localhost:' + (app.server.address()).port + '/graphql', 'graphql-ws')
  const client = WebSocket.createWebSocketStream(ws, { encoding: 'utf8', objectMode: true })
  client.setEncoding('utf8')
  return { client, ws }
}

test('GraphQL subscription authorization (same user)', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    subscriptions: true,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      delete: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      },
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))

  await app.listen({ port: 0 })

  const { client } = createWebSocketClient(app)
  teardown(() => { client.destroy() })

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  client.write(JSON.stringify({
    type: 'connection_init',
    payload: {
      authorization: `Bearer ${token}`
    }
  }))

  {
    const query = `subscription {
      pageSaved {
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
    equal(data.type, 'connection_ack')
  }

  const events = []
  const wrap = new PassThrough({ objectMode: true, transform (chunk, enc, cb) { cb(null, JSON.parse(chunk)) } })
  client.pipe(wrap)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 42
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1?fields=id,title',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 200, 'POST /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'POST /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'DELETE /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World',
      userId: 42
    }, 'DELETE /pages/1')
  }

  for await (const data of wrap) {
    events.push(data)
    if (events.length === 3) {
      break
    }
  }

  same(events, [{
    id: 1,
    type: 'data',
    payload: {
      data: {
        pageSaved: {
          id: 1,
          title: 'Hello'
        }
      }
    }
  }, {
    id: 1,
    type: 'data',
    payload: {
      data: {
        pageSaved: {
          id: 1,
          title: 'Hello World'
        }
      }
    }
  }, {
    id: 1,
    type: 'data',
    payload: {
      data: {
        pageDeleted: {
          id: 1,
          title: 'Hello World'
        }
      }
    }
  }], 'events')
})

test('GraphQL subscription authorization (two users, they can\' see each other data)', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    subscriptions: true,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      },
      delete: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      },
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))

  await app.listen({ port: 0 })

  const client1 = createWebSocketClient(app).client
  teardown(() => { client1.destroy() })

  {
    const token = await app.jwt.sign({
      'X-PLATFORMATIC-USER-ID': 42,
      'X-PLATFORMATIC-ROLE': 'user'
    })

    client1.write(JSON.stringify({
      type: 'connection_init',
      payload: {
        authorization: `Bearer ${token}`
      }
    }))
  }

  {
    const query = `subscription {
      pageSaved {
        id
        title
      }
    }`
    client1.write(JSON.stringify({
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
    client1.write(JSON.stringify({
      id: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const [chunk] = await once(client1, 'data')
    const data = JSON.parse(chunk)
    equal(data.type, 'connection_ack')
  }

  const events1 = []
  const wrap1 = new PassThrough({ objectMode: true, transform (chunk, enc, cb) { cb(null, JSON.parse(chunk)) } })
  client1.pipe(wrap1)

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const client2 = createWebSocketClient(app).client
  teardown(() => { client2.destroy() })

  client2.write(JSON.stringify({
    type: 'connection_init',
    payload: {
      authorization: `Bearer ${token}`
    }
  }))

  {
    const query = `subscription {
      pageSaved {
        id
        title
      }
    }`
    client2.write(JSON.stringify({
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
    client2.write(JSON.stringify({
      id: 1,
      type: 'start',
      payload: {
        query
      }
    }))
  }

  {
    const [chunk] = await once(client2, 'data')
    const data = JSON.parse(chunk)
    equal(data.type, 'connection_ack')
  }

  const events2 = []
  const wrap2 = new PassThrough({ objectMode: true, transform (chunk, enc, cb) { cb(null, JSON.parse(chunk)) } })
  client2.pipe(wrap2)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 43
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1?fields=id,title',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 200, 'POST /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'POST /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'DELETE /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World',
      userId: 43
    }, 'DELETE /pages/1')
  }

  client1.end()

  for await (const data of wrap1) {
    events1.push(data)
    if (events1.length === 3) {
      break
    }
  }

  same(events1, [], 'events')

  for await (const data of wrap2) {
    events2.push(data)
    if (events2.length === 3) {
      break
    }
  }

  same(events2, [{
    type: 'data',
    id: 1,
    payload: {
      data: {
        pageSaved: {
          id: '1',
          title: 'Hello'
        }
      }
    }
  }, {
    type: 'data',
    id: 1,
    payload: {
      data: {
        pageSaved: {
          id: '1',
          title: 'Hello World'
        }
      }
    }
  }, {
    type: 'data',
    id: 1,
    payload: {
      data: {
        pageDeleted: {
          id: '1',
          title: 'Hello World'
        }
      }
    }
  }], 'events')
})

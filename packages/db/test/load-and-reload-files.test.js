'use strict'

const { buildConfig, connInfo, clear, createBasicPages } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request, setGlobalDispatcher, getGlobalDispatcher, MockAgent } = require('undici')
const { join } = require('path')
const os = require('os')
const { writeFile } = require('fs/promises')

test('load and reload', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 1000
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 400, 'add status code')
    same(await res.body.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "add" on type "Query".',
        locations: [{
          line: 3,
          column: 13
        }]
      }]
    }, 'add response')
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }
})

test('error', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => { throw new Error('kaboom') }
        }
      })
    }`)

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 500
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  const res = await request(`${server.url}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          add(x: 2, y: 2)
        }
      `
    })
  })
  equal(res.statusCode, 200, 'add status code')
  same(await res.body.json(), {
    data: {
      add: null
    },
    errors: [{
      message: 'kaboom',
      locations: [{
        line: 3,
        column: 11
      }],
      path: ['add']
    }]
  }, 'add response')
})

test('update config', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)
  const core = {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  }

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core
  }))
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 400, 'add status code')
    same(await res.body.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "add" on type "Query".',
        locations: [{
          line: 3,
          column: 13
        }]
      }]
    }, 'add response')
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`)

  await server.restart({
    core,
    plugin: {
      path: file,
      stopTimeout: 500
    },
    authorization: {}
  })

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }
})

test('mock undici is supported', async ({ teardown, equal, pass, same }) => {
  const previousAgent = getGlobalDispatcher()
  teardown(() => setGlobalDispatcher(previousAgent))

  const mockAgent = new MockAgent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
  setGlobalDispatcher(mockAgent)

  const mockPool = mockAgent.get('http://localhost:42')

  // intercept the request
  mockPool.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, {
    hello: 'world'
  })

  const core = {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  }

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core,
    plugin: {
      path: join(__dirname, 'fixtures', 'undici-plugin.js')
    }
  }))
  teardown(server.stop)
  await server.listen()

  const res = await request(`${server.url}/request`, {
    method: 'GET'
  })
  equal(res.statusCode, 200)
  same(await res.body.json(), {
    hello: 'world'
  })
})

test('load and reload with the fallback', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.js`)

  await writeFile(file, `
    module.exports = async function (app) {
    }`
  )

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 1000,
      fallback: true
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 400, 'add status code')
    same(await res.body.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "add" on type "Query".',
        locations: [{
          line: 3,
          column: 13
        }]
      }]
    }, 'add response')
  }

  await writeFile(file, `
    module.exports = async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }
})

test('load and reload ESM', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `some-plugin-${process.pid}.mjs`)

  await writeFile(file, `
    export default async function (app) {
    }`
  )

  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugin: {
      path: file,
      stopTimeout: 1000
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 400, 'add status code')
    same(await res.body.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "add" on type "Query".',
        locations: [{
          line: 3,
          column: 13
        }]
      }]
    }, 'add response')
  }

  await writeFile(file, `
    export default async function (app) {
      app.graphql.extendSchema(\`
        extend type Query {
          add(x: Int, y: Int): Int
        }
      \`)
      app.graphql.defineResolvers({
        Query: {
          add: async (_, { x, y }) => x + y
        }
      })
    }`)

  await server.restart()

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            add(x: 2, y: 2)
          }
        `
      })
    })
    equal(res.statusCode, 200, 'add status code')
    same(await res.body.json(), {
      data: {
        add: 4
      }
    }, 'add response')
  }
})

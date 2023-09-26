'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfig } = require('./helper')

test('graphql enabled', async (t) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      graphql: true
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
    }
  }))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `
      })
    })
    assert.strictEqual(res.statusCode, 200, 'hello status code')
    assert.deepStrictEqual(await res.body.json(), {
      data: {
        hello: 'world'
      }
    }, 'hello response')
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 200, 'graphiql status code')
  }
})

test('graphql disabled', async (t) => {
  try {
    const app = await buildServer(buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        graphql: false
      },
      plugins: {
        paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    }))
    await app.close()
    assert.fail('should have errored but did not')
  } catch (err) {
    assert.strictEqual(err.message, 'Cannot read properties of undefined (reading \'extendSchema\')')
  }
})

test('disable graphiql', async (t) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      graphql: {
        graphiql: false
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
    }
  }))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `
      })
    })
    assert.strictEqual(res.statusCode, 200, 'hello status code')
    assert.deepStrictEqual(await res.body.json(), {
      data: {
        hello: 'world'
      }
    }, 'hello response')
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 404, 'graphiql status code')
  }
})

test('graphql disabled by default', async (t) => {
  try {
    const app = await buildServer(buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      plugins: {
        paths: [join(__dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    }))
    await app.close()
    assert.fail('should have errored but did not')
  } catch (err) {
    assert.strictEqual(err.message, 'Cannot read properties of undefined (reading \'extendSchema\')')
  }
})

test('graphql errors are correctly propagated in custom resolvers', async (t) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    service: {
      graphql: true
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'throw-resolver.js')]
    }
  }))

  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `
      })
    })
    assert.strictEqual(res.statusCode, 200, 'hello status code')
    assert.deepStrictEqual(await res.body.json(), {
      data: {
        hello: null
      },
      errors: [
        {
          message: 'Kaboooooom!!!',
          locations: [{
            line: 3,
            column: 13
          }],
          path: ['hello']
        }
      ]
    }, 'hello response')
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 200, 'graphiql status code')
  }
})

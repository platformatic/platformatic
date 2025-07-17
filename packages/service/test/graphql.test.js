import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

test('graphql enabled', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        forceCloseConnections: true,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        graphql: true
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

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
    assert.deepStrictEqual(
      await res.body.json(),
      {
        data: {
          hello: 'world'
        }
      },
      'hello response'
    )
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 200, 'graphiql status code')
  }
})

test('graphql disabled', async t => {
  try {
    const app = await createFromConfig(
      t,
      buildConfig({
        server: {
          hostname: '127.0.0.1',
          forceCloseConnections: true,
          port: 0,
          logger: { level: 'fatal' },
          healthCheck: {
            enabled: true,
            interval: 2000
          }
        },
        service: {
          graphql: false
        },
        plugins: {
          paths: [join(import.meta.dirname, 'fixtures', 'hello-world-resolver.js')]
        }
      })
    )

    t.after(async () => {
      await app.stop()
    })
    await app.start({ listen: true })

    assert.fail('should have errored but did not')
  } catch (err) {
    assert.strictEqual(err.message, "Cannot read properties of undefined (reading 'extendSchema')")
  }
})

test('disable graphiql', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        forceCloseConnections: true,
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
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
        paths: [join(import.meta.dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

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
    assert.deepStrictEqual(
      await res.body.json(),
      {
        data: {
          hello: 'world'
        }
      },
      'hello response'
    )
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 404, 'graphiql status code')
  }
})

test('graphql disabled by default', async t => {
  try {
    const app = await createFromConfig(
      t,
      buildConfig({
        server: {
          forceCloseConnections: true,
          hostname: '127.0.0.1',
          port: 0,
          logger: { level: 'fatal' },
          healthCheck: {
            enabled: true,
            interval: 2000
          }
        },
        plugins: {
          paths: [join(import.meta.dirname, 'fixtures', 'hello-world-resolver.js')]
        }
      })
    )

    t.after(async () => {
      await app.stop()
    })
    await app.start({ listen: true })

    assert.fail('should have errored but did not')
  } catch (err) {
    assert.strictEqual(err.message, "Cannot read properties of undefined (reading 'extendSchema')")
  }
})

test('graphql errors are correctly propagated in custom resolvers', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        forceCloseConnections: true,
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        graphql: true
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'throw-resolver.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

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
    assert.deepStrictEqual(
      await res.body.json(),
      {
        data: {
          hello: null
        },
        errors: [
          {
            message: 'Kaboooooom!!!',
            locations: [
              {
                line: 3,
                column: 13
              }
            ],
            path: ['hello']
          }
        ]
      },
      'hello response'
    )
  }

  {
    const res = await request(`${app.url}/graphiql`)
    assert.strictEqual(res.statusCode, 200, 'graphiql status code')
  }
})

test('do not include /graphql in the OpenAPI schema', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        forceCloseConnections: true,
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        graphql: true,
        openapi: true
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'hello-world-resolver.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/documentation/json`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const body = await res.body.json()
  assert.strictEqual(body.paths['/graphql'], undefined)
})

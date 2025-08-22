import assert from 'assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig, createGraphqlApplication } from './helper.js'

test('should resolve openapi applications to the origin', async t => {
  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      applications: [
        {
          id: 'service1',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
          }
        },
        {
          id: 'service2',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
          }
        }
      ]
    }
  })

  await composer.start({ listen: true })

  const applications = composer.getApplication().platformatic.config.composer.applications
  assert.equal(applications.length, 2)

  assert.equal(applications[0].id, 'service1')
  assert.equal(applications[0].origin, 'http://service1.plt.local')

  assert.equal(applications[1].id, 'service2')
  assert.equal(applications[1].origin, 'http://service2.plt.local')
})

test('should resolve graphql applications', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: `
    type Query {
      add(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async add (_, { x, y }) {
          return x + y
        }
      }
    }
  })
  const graphql2 = await createGraphqlApplication(t, {
    schema: `
    type Query {
      mul(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async mul (_, { x, y }) {
          return x * y
        }
      }
    }
  })

  const graphql1Host = await graphql1.listen()
  const graphql2Host = await graphql2.listen()

  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Host,
          graphql: true
        },
        {
          id: 'graphql2',
          origin: graphql2Host,
          graphql: true
        }
      ]
    }
  })

  await composer.start({ listen: true })

  const applications = composer.getApplication().platformatic.config.composer.applications
  assert.equal(applications.length, 2)
  assert.equal(applications[0].id, 'graphql1')
  assert.equal(applications[1].id, 'graphql2')
})

test('should resolve different applications', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: `
    type Query {
      add(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async add (_, { x, y }) {
          return x + y
        }
      }
    }
  })

  const graphql2 = await createGraphqlApplication(t, {
    schema: `
    type Query {
      mul(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async mul (_, { x, y }) {
          return x * y
        }
      }
    }
  })

  const graphql1Host = await graphql1.listen()
  const graphql2Host = await graphql2.listen()

  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      applications: [
        {
          id: 'graphql',
          origin: graphql1Host,
          graphql: true
        },
        {
          id: 'openapi',
          origin: 'http://openapi.plt.local',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
          }
        },
        {
          id: 'openapi-and-graphql',
          origin: 'http://openapi-and-graphql.plt.local',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
          },
          graphql: {
            host: graphql2Host
          }
        },
        {
          id: 'none'
        }
      ]
    }
  })

  await composer.start({ listen: true })

  const applications = composer.getApplication().platformatic.config.composer.applications
  assert.equal(applications.length, 4)

  assert.equal(applications[0].id, 'graphql')
  assert.equal(applications[0].origin, graphql1Host)
  assert.ok(!applications[0].openapi)
  assert.ok(applications[0].graphql)

  assert.equal(applications[1].id, 'openapi')
  assert.equal(applications[1].origin, 'http://openapi.plt.local')
  assert.ok(applications[1].openapi)
  assert.ok(!applications[1].graphql)

  assert.equal(applications[2].id, 'openapi-and-graphql')
  assert.equal(applications[2].origin, 'http://openapi-and-graphql.plt.local')
  assert.ok(applications[2].openapi)
  assert.ok(applications[2].graphql)

  assert.equal(applications[3].id, 'none')
  assert.equal(applications[3].origin, 'http://none.plt.local')
  assert.ok(!applications[3].openapi)
  assert.ok(!applications[3].graphql)
})

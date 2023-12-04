'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')

const { createComposer, createGraphqlService } = require('./helper')

test('should resolve openapi services to the origin', async (t) => {
  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'service1',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
            }
          },
          {
            id: 'service2',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
            }
          }
        ]
      }
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 2)

  assert.equal(services[0].id, 'service1')
  assert.equal(services[0].origin, 'http://service1.plt.local')

  assert.equal(services[1].id, 'service2')
  assert.equal(services[1].origin, 'http://service2.plt.local')
})

test('should resolve graphql services', async (t) => {
  const graphql1 = await createGraphqlService(t, {
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
  const graphql2 = await createGraphqlService(t, {
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

  const composer = await createComposer(t,
    {
      composer: {
        services: [
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
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 2)
  assert.equal(services[0].id, 'graphql1')
  assert.equal(services[1].id, 'graphql2')
})

test('should resolve different services', async (t) => {
  const graphql1 = await createGraphqlService(t, {
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

  const graphql2 = await createGraphqlService(t, {
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

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql',
            origin: graphql1Host,
            graphql: true
          },
          {
            id: 'openapi',
            origin: 'http://openapi.plt.local',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
            }
          },
          {
            id: 'openapi-and-graphql',
            origin: 'http://openapi-and-graphql.plt.local',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
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
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 4)

  assert.equal(services[0].id, 'graphql')
  assert.equal(services[0].origin, graphql1Host)
  assert.ok(!services[0].openapi)
  assert.ok(services[0].graphql)

  assert.equal(services[1].id, 'openapi')
  assert.equal(services[1].origin, 'http://openapi.plt.local')
  assert.ok(services[1].openapi)
  assert.ok(!services[1].graphql)

  assert.equal(services[2].id, 'openapi-and-graphql')
  assert.equal(services[2].origin, 'http://openapi-and-graphql.plt.local')
  assert.ok(services[2].openapi)
  assert.ok(services[2].graphql)

  assert.equal(services[3].id, 'none')
  assert.equal(services[3].origin, 'http://none.plt.local')
  assert.ok(!services[3].openapi)
  assert.ok(!services[3].graphql)
})

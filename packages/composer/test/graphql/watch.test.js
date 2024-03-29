'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const path = require('node:path')
const dedent = require('dedent')
const { createGraphqlService, createComposer, createLoggerSpy, eventToPromise } = require('../helper')

const REFRESH_TIMEOUT = 500
const RESTART_TIMEOUT = 3_000

test('should restart composer if a service has been changed, and update the schema', async (t) => {
  const schema1 = dedent`
  type Query {
    add(x: Int, y: Int): Int
  }`
  const schema2 = dedent`
  type Query {
    sum(a: Int, b: Int): Int
  }`

  const graphql1 = await createGraphqlService(t, {
    schema: schema1,
    resolvers: {
      Query: { add: (_, { x, y }) => x + y }
    }
  })

  await graphql1.listen()
  const port = graphql1.server.address().port
  const origin = 'http://localhost:' + port

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin,
            graphql: true
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    }
  )

  await composer.start()
  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)

  const graphql1a = await createGraphqlService(t, {
    schema: schema2,
    resolvers: {
      Query: { sum: (_, { a, b }) => a + b }
    }
  })

  assert.equal(composer.graphqlSupergraph.sdl, schema1)

  await graphql1.close()
  await graphql1a.listen({ port })

  await restart

  assert.equal(composer.restarted, true, 'expected composer to restart')
  assert.equal(composer.graphqlSupergraph.sdl, schema2)
})

test('composer should restart and update schema if one of the services shuts down', async (t) => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { dice: Int }',
    resolvers: { Query: { dice: () => Math.floor(Math.random() * 6) + 1 } },
    extend: {
      file: path.join(__dirname, 'fixtures', 'hello.js')
    }
  })
  const graphql2 = await createGraphqlService(t, {
    file: path.join(__dirname, 'fixtures', 'dogs.js')
  })

  const supergraph1 = dedent`type Query {
    dice: Int
    hello: String
    dogs: [Dog]!
    dog(id: ID!): Dog
  }
  
  type Mutation {
    createDog(dog: CreateDogInput!): Dog!
    updateDog(id: ID!, dog: UpdateDogInput!): Dog
    deleteDog(id: ID!): ID
  }
  
  type Dog {
    id: ID!
    name: String
  }
  
  input CreateDogInput {
    name: String!
  }
  
  input UpdateDogInput {
    name: String!
  }`

  const supergraph2 = dedent`type Query {
    dogs: [Dog]!
    dog(id: ID!): Dog
  }
  
  type Mutation {
    createDog(dog: CreateDogInput!): Dog!
    updateDog(id: ID!, dog: UpdateDogInput!): Dog
    deleteDog(id: ID!): ID
  }
  
  type Dog {
    id: ID!
    name: String
  }
  
  input CreateDogInput {
    name: String!
  }
  
  input UpdateDogInput {
    name: String!
  }`
  const graphql1Origin = await graphql1.listen()
  const graphql2Origin = await graphql2.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: graphql1Origin,
            graphql: true
          },
          {
            id: 'graphql2',
            origin: graphql2Origin,
            graphql: true
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    }
  )

  await composer.start()
  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)

  assert.equal(composer.graphqlSupergraph.sdl, supergraph1)

  await graphql1.close()
  await restart

  assert.equal(composer.restarted, true, 'expected composer to restart')
  assert.equal(composer.graphqlSupergraph.sdl, supergraph2)
})

test('should not restart if services did not change', async (t) => {
  const services = [
    {
      schema: dedent`
      type Query {
        add(x: Int, y: Int): Int
      }`,
      resolvers: { Query: { add: (_, { x, y }) => x + y } }
    },
    {
      schema: dedent`
      type Query {
        mul(a: Int, b: Int): Int
      }`,
      resolvers: { Query: { mul: (_, { a, b }) => a * b } }
    },
    {
      schema: dedent`
      type Query {
        sub(x: Int, y: Int): Int
      }`,
      resolvers: { Query: { sub: (_, { x, y }) => x - y } }
    }]

  for (const service of services) {
    service.instance = await createGraphqlService(t, {
      schema: service.schema,
      resolvers: service.resolvers
    })
    service.origin = await service.instance.listen()
  }

  const composer = await createComposer(t,
    {
      composer: {
        services: services.map((service, i) => ({
          id: 'graphql' + i,
          origin: service.origin,
          graphql: true
        })),
        refreshTimeout: REFRESH_TIMEOUT
      }
    }
  )

  await composer.start()

  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)
  await restart

  assert.equal(composer.restarted, false)
})

test('should not watch when refreshTimeout is 0', async (t) => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } }
  })
  const graphql2 = await createGraphqlService(t, {
    file: path.join(__dirname, 'fixtures', 'dogs.js')
  })

  const supergraph1 = dedent`type Query {
    cheatingDice: Int
    dogs: [Dog]!
    dog(id: ID!): Dog
  }
  
  type Mutation {
    createDog(dog: CreateDogInput!): Dog!
    updateDog(id: ID!, dog: UpdateDogInput!): Dog
    deleteDog(id: ID!): ID
  }
  
  type Dog {
    id: ID!
    name: String
  }
  
  input CreateDogInput {
    name: String!
  }
  
  input UpdateDogInput {
    name: String!
  }`
  const graphql1Origin = await graphql1.listen()
  const graphql2Origin = await graphql2.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: graphql1Origin,
            graphql: true
          },
          {
            id: 'graphql2',
            origin: graphql2Origin,
            graphql: true
          }
        ],
        refreshTimeout: 0
      }
    }
  )

  await composer.start()
  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)

  assert.equal(composer.graphqlSupergraph.sdl, supergraph1)

  await graphql1.close()
  await graphql2.close()

  await restart

  assert.equal(composer.restarted, false)
  assert.equal(composer.graphqlSupergraph.sdl, supergraph1)
})

test('should not watch if there are no fetchable services', async (t) => {
  const logger = createLoggerSpy()

  const composer = await createComposer(t, {
    composer: { services: [] }
  }, logger)
  await composer.start()

  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)
  await restart

  assert.ok(!logger._info.find(l => l[1] === 'start watching services'))
})

test('should handle errors watching services', async (t) => {
  const logger = createLoggerSpy()

  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } }
  })

  const graphql1Origin = await graphql1.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: graphql1Origin,
            graphql: true
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    }, logger
  )

  await composer.start()
  const restart = eventToPromise(composer.addOnRestartHook, RESTART_TIMEOUT)

  await graphql1.close()
  await restart

  assert.ok(logger._error.find(l => l[1] === 'failed to restart server'))
})

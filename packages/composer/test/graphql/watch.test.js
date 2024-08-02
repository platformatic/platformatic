'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const path = require('node:path')
const dedent = require('dedent')
const {
  createGraphqlService,
  createComposerInRuntime,
  checkSchema,
  getRuntimeLogs,
  waitForRestart,
} = require('../helper')

const REFRESH_TIMEOUT = 1000

test('should restart composer if a service has been changed, and update the schema', async t => {
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
      Query: { add: (_, { x, y }) => x + y },
    },
  })

  await graphql1.listen()
  const port = graphql1.server.address().port
  const origin = 'http://localhost:' + port

  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: {
      services: [
        {
          id: 'graphql1',
          origin,
          graphql: true,
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  await runtime.start()

  const graphql1a = await createGraphqlService(t, {
    schema: schema2,
    resolvers: {
      Query: { sum: (_, { a, b }) => a + b },
    },
  })

  assert.ok(checkSchema(runtime, schema1))

  await graphql1.close()
  await graphql1a.listen({ port })

  await waitForRestart(runtime)

  assert.ok(await checkSchema(runtime, schema2))
})

test('composer should restart and update schema if one of the services shuts down', async t => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { dice: Int }',
    resolvers: { Query: { dice: () => Math.floor(Math.random() * 6) + 1 } },
    extend: {
      file: path.join(__dirname, 'fixtures', 'hello.js'),
    },
  })
  const graphql2 = await createGraphqlService(t, {
    file: path.join(__dirname, 'fixtures', 'dogs.js'),
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

  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: {
      services: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true,
        },
        {
          id: 'graphql2',
          origin: graphql2Origin,
          graphql: true,
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  await runtime.start()

  assert.ok(checkSchema(runtime, supergraph1))

  await graphql1.close()

  await waitForRestart(runtime)

  assert.ok(checkSchema(runtime, supergraph2))
})

test('should not restart if services did not change', async t => {
  const services = [
    {
      schema: dedent`
      type Query {
        add(x: Int, y: Int): Int
      }`,
      resolvers: { Query: { add: (_, { x, y }) => x + y } },
    },
    {
      schema: dedent`
      type Query {
        mul(a: Int, b: Int): Int
      }`,
      resolvers: { Query: { mul: (_, { a, b }) => a * b } },
    },
    {
      schema: dedent`
      type Query {
        sub(x: Int, y: Int): Int
      }`,
      resolvers: { Query: { sub: (_, { x, y }) => x - y } },
    },
  ]

  for (const service of services) {
    service.instance = await createGraphqlService(t, {
      schema: service.schema,
      resolvers: service.resolvers,
    })
    service.origin = await service.instance.listen()
  }

  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: {
      services: services.map((service, i) => ({
        id: 'graphql' + i,
        origin: service.origin,
        graphql: true,
      })),
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  await runtime.start()

  await assert.rejects(() => waitForRestart(runtime))
})

test('should not watch when refreshTimeout is 0', async t => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } },
  })
  const graphql2 = await createGraphqlService(t, {
    file: path.join(__dirname, 'fixtures', 'dogs.js'),
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

  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: {
      services: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true,
        },
        {
          id: 'graphql2',
          origin: graphql2Origin,
          graphql: true,
        },
      ],
      refreshTimeout: 0,
    },
  })

  await runtime.start()

  assert.ok(checkSchema(runtime, supergraph1))

  await graphql1.close()
  await graphql2.close()

  await assert.rejects(() => waitForRestart(runtime))
  assert.ok(checkSchema(runtime, supergraph1))
})

test('should not watch if there are no fetchable services', async t => {
  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: { services: [] },
  })
  await runtime.start()

  const messages = await getRuntimeLogs(runtime)

  assert.ok(!messages.find(l => l === 'start watching services'))
})

test('should handle errors watching services', async t => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } },
  })

  const graphql1Origin = await graphql1.listen()

  const runtime = await createComposerInRuntime(t, 'graphql-watch', {
    composer: {
      services: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true,
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  await runtime.start()

  await graphql1.close()

  const messages = await getRuntimeLogs(runtime)

  assert.ok(messages.find(l => l.startsWith('Service composer unexpectedly exited with code 1')))
})

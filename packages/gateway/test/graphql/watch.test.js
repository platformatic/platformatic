import dedent from 'dedent'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import path from 'node:path'
import { test } from 'node:test'
import { checkSchema, createGatewayInRuntime, createGraphqlApplication, waitForRestart } from '../helper.js'

const REFRESH_TIMEOUT = 1000

test('should restart gateway if a application has been changed, and update the schema', async t => {
  const schema1 = dedent`
  type Query {
    add(x: Int, y: Int): Int
  }`
  const schema2 = dedent`
  type Query {
    sum(a: Int, b: Int): Int
  }`

  const graphql1 = await createGraphqlApplication(t, {
    schema: schema1,
    resolvers: {
      Query: { add: (_, { x, y }) => x + y }
    }
  })

  await graphql1.listen()
  const port = graphql1.server.address().port
  const origin = 'http://localhost:' + port

  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: {
      applications: [
        {
          id: 'graphql1',
          origin,
          graphql: true
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  await runtime.start({ listen: true })

  const graphql1a = await createGraphqlApplication(t, {
    schema: schema2,
    resolvers: {
      Query: { sum: (_, { a, b }) => a + b }
    }
  })

  assert.ok(checkSchema(runtime, schema1))

  await graphql1.close()
  await graphql1a.listen({ port })

  await waitForRestart(runtime)

  assert.ok(await checkSchema(runtime, schema2))
})

test('gateway should restart and update schema if one of the applications shuts down', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: 'type Query { dice: Int }',
    resolvers: { Query: { dice: () => Math.floor(Math.random() * 6) + 1 } },
    extend: {
      file: path.join(import.meta.dirname, 'fixtures', 'hello.js')
    }
  })
  const graphql2 = await createGraphqlApplication(t, {
    file: path.join(import.meta.dirname, 'fixtures', 'dogs.js')
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

  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: {
      applications: [
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
  })

  await runtime.start({ listen: true })

  assert.ok(checkSchema(runtime, supergraph1))

  await graphql1.close()

  await waitForRestart(runtime)

  assert.ok(checkSchema(runtime, supergraph2))
})

test('should not restart if applications did not change', async t => {
  const applications = [
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
    }
  ]

  for (const application of applications) {
    application.instance = await createGraphqlApplication(t, {
      schema: application.schema,
      resolvers: application.resolvers
    })
    application.origin = await application.instance.listen()
  }

  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: {
      applications: applications.map((application, i) => ({
        id: 'graphql' + i,
        origin: application.origin,
        graphql: true
      })),
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  await runtime.start({ listen: true })

  await assert.rejects(() => waitForRestart(runtime))
})

test('should not watch when refreshTimeout is 0', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } }
  })
  const graphql2 = await createGraphqlApplication(t, {
    file: path.join(import.meta.dirname, 'fixtures', 'dogs.js')
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

  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: {
      applications: [
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
  })

  await runtime.start({ listen: true })

  assert.ok(checkSchema(runtime, supergraph1))

  await graphql1.close()
  await graphql2.close()

  await assert.rejects(() => waitForRestart(runtime))
  assert.ok(checkSchema(runtime, supergraph1))
})

test('should not watch if there are no fetchable applications', async t => {
  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: { applications: [] }
  })

  let watching = false
  runtime.on('watch:start', () => {
    watching = true
  })

  await runtime.start({ listen: true })
  await runtime.stop()

  assert.ok(!watching)
})

test('should handle errors watching applications', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: 'type Query { cheatingDice: Int }',
    resolvers: { Query: { cheatingDice: () => 3 } }
  })

  const graphql1Origin = await graphql1.listen()

  const runtime = await createGatewayInRuntime(t, 'graphql-watch', {
    gateway: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Origin,
          graphql: true
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  await runtime.start({ listen: true })

  await graphql1.close()

  const [startingEvent] = await once(runtime, 'application:worker:starting')
  const [startErrorEvent] = await once(runtime, 'application:worker:start:error')
  assert.deepEqual(startingEvent.application, 'composer')
  assert.deepEqual(startErrorEvent.application, 'composer')
})

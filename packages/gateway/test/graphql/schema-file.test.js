import dedent from 'dedent'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  checkSchema,
  createFromConfig,
  createGatewayInRuntime,
  createGraphqlApplication,
  graphqlRequest,
  waitForRestart
} from '../helper.js'

const REFRESH_TIMEOUT = 1000

const addSchema = dedent`
  type Query {
    add(x: Int, y: Int): Int
  }`
const addResolvers = { Query: { add: (_, { x, y }) => x + y } }

const mulSchema = dedent`
  type Query {
    mul(a: Int, b: Int): Int
  }`
const mulResolvers = { Query: { mul: (_, { a, b }) => a * b } }

async function writeSchemaFile (sdl, name = 'schema.graphql') {
  const cwd = await mkdtemp(join(tmpdir(), 'gateway-graphql-'))
  const file = join(cwd, name)
  await writeFile(file, sdl)
  return file
}

// a graphql application recording the requests it receives,
// to tell the queries from the requests to compose its schema
async function createTrackedGraphqlApplication (t, { schema, resolvers }) {
  const requests = []
  const application = await createGraphqlApplication(t, { schema, resolvers })
  application.addHook('preHandler', async request => {
    if (request.url === '/.well-known/graphql-composition' || request.body?.query?.includes('__schema')) {
      requests.push('compose')
    } else {
      requests.push(request.url)
    }
  })
  const origin = await application.listen({ port: 0 })
  return { application, origin, requests }
}

async function startGateway (t, applications) {
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: { applications }
  })

  return gateway.start({ listen: true })
}

test('should compose a graphql application from a schema file, without fetching its schema', async t => {
  const graphql1 = await createTrackedGraphqlApplication(t, { schema: addSchema, resolvers: addResolvers })
  const file = await writeSchemaFile(addSchema)

  const gatewayHost = await startGateway(t, [
    {
      id: 'graphql1',
      origin: graphql1.origin,
      graphql: { file }
    }
  ])

  assert.deepEqual(graphql1.requests, [])

  const response = await graphqlRequest({ query: '{ add (x: 2, y: 3) }', host: gatewayHost })
  assert.deepEqual(response, { add: 5 })
  assert.deepEqual(graphql1.requests, ['/graphql'])
})

test('should send the queries of a graphql application from a schema file to its host and graphqlEndpoint', async t => {
  const graphql1 = await createGraphqlApplication(t, { schema: addSchema, resolvers: addResolvers })
  const graphql1Host = await graphql1.listen({ port: 0 })
  const file = await writeSchemaFile(addSchema)

  const gatewayHost = await startGateway(t, [
    {
      id: 'graphql1',
      origin: 'http://127.0.0.1:1',
      graphql: { file, host: graphql1Host, graphqlEndpoint: '/graphql' }
    }
  ])

  const response = await graphqlRequest({ query: '{ add (x: 4, y: 5) }', host: gatewayHost })
  assert.deepEqual(response, { add: 9 })
})

test('should start with a graphql application from a schema file while the application is down', async t => {
  const graphql1 = await createGraphqlApplication(t, { schema: addSchema, resolvers: addResolvers })
  const graphql1Host = await graphql1.listen({ port: 0 })
  await graphql1.close()
  const file = await writeSchemaFile(addSchema)

  const gatewayHost = await startGateway(t, [
    {
      id: 'graphql1',
      origin: graphql1Host,
      graphql: { file }
    }
  ])

  const errors = await graphqlRequest({ query: '{ add (x: 2, y: 3) }', host: gatewayHost })
  assert.ok(Array.isArray(errors))
  assert.match(errors[0].message, /ECONNREFUSED/)
})

test('should compose a graphql application from a schema file and one from the application', async t => {
  const graphql1 = await createTrackedGraphqlApplication(t, { schema: addSchema, resolvers: addResolvers })
  const graphql2 = await createTrackedGraphqlApplication(t, { schema: mulSchema, resolvers: mulResolvers })
  const file = await writeSchemaFile(addSchema)

  const gatewayHost = await startGateway(t, [
    {
      id: 'graphql1',
      origin: graphql1.origin,
      graphql: { file }
    },
    {
      id: 'graphql2',
      origin: graphql2.origin,
      graphql: true
    }
  ])

  assert.deepEqual(graphql1.requests, [])
  assert.deepEqual(graphql2.requests, ['compose'])

  assert.deepEqual(await graphqlRequest({ query: '{ add (x: 2, y: 3) }', host: gatewayHost }), { add: 5 })
  assert.deepEqual(await graphqlRequest({ query: '{ mul (a: 2, b: 3) }', host: gatewayHost }), { mul: 6 })
})

test('should throw an error if the graphql schema file does not exist', async t => {
  const file = resolve(await mkdtemp(join(tmpdir(), 'gateway-graphql-')), 'missing.graphql')

  await assert.rejects(
    startGateway(t, [
      {
        id: 'graphql1',
        origin: 'http://127.0.0.1:1',
        graphql: { file }
      }
    ]),
    err => {
      assert.equal(err.code, 'PLT_GATEWAY_COULD_NOT_READ_GRAPHQL_SCHEMA_FILE')
      assert.ok(err.message.includes(file))
      assert.match(err.message, /of the "graphql1" application/)
      assert.match(err.message, /ENOENT/)
      return true
    }
  )
})

test('should throw an error if the graphql schema file is not valid sdl', async t => {
  const file = await writeSchemaFile('type Query { add(x: Int, y: Int): Int')

  await assert.rejects(
    startGateway(t, [
      {
        id: 'graphql1',
        origin: 'http://127.0.0.1:1',
        graphql: { file }
      }
    ]),
    err => {
      assert.equal(err.code, 'PLT_GATEWAY_INVALID_GRAPHQL_SCHEMA_FILE')
      assert.ok(err.message.includes(file))
      assert.match(err.message, /of the "graphql1" application is not a valid GraphQL schema/)
      assert.match(err.message, /Syntax Error/)
      return true
    }
  )
})

test('should throw an error if the graphql schema file is not a valid schema', async t => {
  const file = await writeSchemaFile('type Query { dog: Dog }')

  await assert.rejects(
    startGateway(t, [
      {
        id: 'graphql1',
        origin: 'http://127.0.0.1:1',
        graphql: { file }
      }
    ]),
    err => {
      assert.equal(err.code, 'PLT_GATEWAY_INVALID_GRAPHQL_SCHEMA_FILE')
      assert.match(err.message, /Unknown type "Dog"/)
      return true
    }
  )
})

test('should resolve the graphql schema file relative to the configuration file, and not restart on watch', async t => {
  const graphql1 = await createTrackedGraphqlApplication(t, { schema: addSchema, resolvers: addResolvers })
  const graphql2 = await createTrackedGraphqlApplication(t, { schema: mulSchema, resolvers: mulResolvers })

  // the application composed from file is down, the other one is fetched on watch
  await graphql1.application.close()

  const runtime = await createGatewayInRuntime(
    t,
    'graphql-schema-file',
    {
      gateway: {
        applications: [
          {
            id: 'graphql1',
            origin: graphql1.origin,
            graphql: { file: './schemas/graphql1.graphql' }
          },
          {
            id: 'graphql2',
            origin: graphql2.origin,
            graphql: true
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    undefined,
    undefined,
    undefined,
    false,
    async (_runtimeConfigPath, gatewayConfigPath) => {
      const dir = resolve(gatewayConfigPath, '..', 'schemas')
      await mkdir(dir, { recursive: true })
      await writeFile(resolve(dir, 'graphql1.graphql'), addSchema)
    }
  )

  const entrypoint = await runtime.start({ listen: true })

  const supergraph = dedent`type Query {
    add(x: Int, y: Int): Int
    mul(a: Int, b: Int): Int
  }`
  assert.ok(await checkSchema(runtime, supergraph))

  assert.deepEqual(await graphqlRequest({ query: '{ mul (a: 2, b: 3) }', host: entrypoint }), { mul: 6 })

  // the supergraph composed on watch includes the application from file, so the gateway does not restart
  await assert.rejects(() => waitForRestart(runtime))
  assert.ok(await checkSchema(runtime, supergraph))
  assert.ok(graphql2.requests.filter(r => r === 'compose').length > 1)
})

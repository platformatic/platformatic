'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { isatty } = require('tty')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get service graphql schema', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
    ])
  })

  const res = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-db/graphql-schema',
  })

  const { statusCode, body } = res
  assert.strictEqual(statusCode, 200)

  const graphqlSchema = await body.text()

  const logger = {}
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty',
    }
  }

  assert.deepStrictEqual(graphqlSchema,
`type Query {
  getMovieById(id: ID!): Movie
  movies(limit: LimitInt, offset: Int, orderBy: [MovieOrderByArguments], where: MovieWhereArguments): [Movie]
  countMovies(where: MovieWhereArguments): moviesCount
}

type Movie {
  id: ID
  title: String
}

"""
Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
"""
scalar LimitInt

input MovieOrderByArguments {
  field: MovieOrderByField
  direction: OrderByDirection!
}

enum MovieOrderByField {
  id
  title
}

enum OrderByDirection {
  ASC
  DESC
}

input MovieWhereArguments {
  id: MovieWhereArgumentsid
  title: MovieWhereArgumentstitle
  or: [MovieWhereArgumentsOr]
}

input MovieWhereArgumentsid {
  eq: ID
  neq: ID
  gt: ID
  gte: ID
  lt: ID
  lte: ID
  like: ID
  in: [ID]
  nin: [ID]
}

input MovieWhereArgumentstitle {
  eq: String
  neq: String
  gt: String
  gte: String
  lt: String
  lte: String
  like: String
  in: [String]
  nin: [String]
}

input MovieWhereArgumentsOr {
  id: MovieWhereArgumentsid
  title: MovieWhereArgumentstitle
}

type moviesCount {
  total: Int
}

type Mutation {
  saveMovie(input: MovieInput!): Movie
  insertMovies(inputs: [MovieInput]!): [Movie]
  deleteMovies(where: MovieWhereArguments): [Movie]
}

input MovieInput {
  id: ID
  title: String
}`)
})

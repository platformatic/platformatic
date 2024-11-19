import { createServer } from 'node:http'

globalThis.platformatic.setOpenapiSchema('TEST_OPEN_API_SCHEMA')
globalThis.platformatic.setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
globalThis.platformatic.setConnectionString('TEST_CONNECTION_STRING')

const server = createServer((_req, res) => {
  res.end(JSON.stringify({ ok: true }))
})

server.listen(1)

import { setBasePath, setConnectionString, setGraphqlSchema, setOpenapiSchema } from '@platformatic/globals'
import { createServer } from 'node:http'

setOpenapiSchema('TEST_OPEN_API_SCHEMA')
setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
setConnectionString('TEST_CONNECTION_STRING')
setBasePath('TEST_BASE_PATH')

const server = createServer((_req, res) => {
  res.end(JSON.stringify({ ok: true }))
})

server.listen(0)

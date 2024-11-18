// @ts-expect-error
import { createServer } from 'node:http'

console.log('Setting OpenApi connection string', globalThis.platformatic)
globalThis.platformatic.setOpenapiSchema('TEST_OPEN_API_SCHEMA')
globalThis.platformatic.setConnectionString('TEST_CONNECTION_STRING')
console.log('OpenApi connection string set', globalThis.platformatic)

const server = createServer((_req, res) => {
  res.end(JSON.stringify({ ok: true }))
})

// This would likely fail if our code doesn't work
server.listen(1)

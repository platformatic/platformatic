import { createServer } from 'node:http'

// This service runs as a command (`node index.mjs`), so it is executed in a child
// process through the childManager and reports its own process-level metrics.
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ hello: 'world' }))
})

server.listen({ host: '127.0.0.1', port: 0 })

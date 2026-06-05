import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ receivedHeader: req.headers['x-user-dispatcher'] ?? null }))
})

server.listen(0)

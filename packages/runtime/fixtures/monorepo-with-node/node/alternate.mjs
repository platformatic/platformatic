import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ alternate: true }))
})

server.listen(1)

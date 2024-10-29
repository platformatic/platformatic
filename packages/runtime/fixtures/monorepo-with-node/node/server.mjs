import { createServer } from 'node:http'

let count = 0

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ content: `from node:http createServer: ${count++}!` }))
})

server.listen(1)

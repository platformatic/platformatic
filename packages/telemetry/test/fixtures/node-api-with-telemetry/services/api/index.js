import { createServer } from 'node:http'

const server = createServer((req, res) => {
  console.log('received request', req.headers)
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ foo: 'bar' }))
})
server.listen(1)

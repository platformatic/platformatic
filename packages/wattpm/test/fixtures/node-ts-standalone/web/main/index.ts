import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })
  res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
})

// This would likely fail if our code doesn't work
server.listen(1)

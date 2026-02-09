'use strict'

const { createServer } = require('node:http')

const server = createServer((req, res) => {
  if (req.url === '/hello') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ capability: 'node-child-process' }))
    return
  }
  if (req.url === '/redirect') {
    res.writeHead(302, { Location: '/hello' })
    res.end()
    return
  }
  throw new Error(`Unexpected request: ${req.url}`)
})

server.listen(1)

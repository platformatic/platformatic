import { getHost, getPort } from '@platformatic/globals'
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
  } else {
    res.writeHead(404, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ ok: false }))
  }
})

server.listen({
  host: getHost() === true ? '127.0.0.1' : getHost(),
  port: getPort() === true ? 0 : getPort()
})

import { getAdditionalServerOptions, getWorkerId } from '@platformatic/globals'
import { createServer } from 'node:https'

const server = createServer(getAdditionalServerOptions(), (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close',
      'x-plt-worker-id': getWorkerId()
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

server.listen(0)

import { getApplicationId } from '@platformatic/globals'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

export function create () {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => {
      res.writeHead(200, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ service: getApplicationId(), method: req.method, body }))
    })
  })

  const wsServer = new WebSocketServer({ server })
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })

  return server
}

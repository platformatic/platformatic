import { WebSocketServer } from 'ws'

export default async function (app) {
  const wsServer = new WebSocketServer({ server: app.server })

  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })

  app.addHook('onClose', () => {
    wsServer.close()
  })

  app.get('/', async () => {
    return { service: 'echo-service' }
  })
}

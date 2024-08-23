import { createServer, type IncomingMessage, type OutgoingMessage } from 'node:http'

createServer((_: IncomingMessage, res: OutgoingMessage) => {
  res.end(JSON.stringify({ ok: true }))
}).listen(3000)

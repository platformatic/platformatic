import { createServer } from 'node:http'

const server = createServer((_, res) => {
  res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
})

server.listen(0)

globalThis.platformatic?.events.on('close', () => {
  globalThis.platformatic?.events.emitAndNotify('close:handler')
})

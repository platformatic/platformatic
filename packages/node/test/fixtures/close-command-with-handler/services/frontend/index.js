import { createServer } from 'node:http'

const server = createServer((_, res) => {
  res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
})

// This would likely fail if our code doesn't work
server.listen(1)

globalThis.platformatic?.events.on('close', () => {
  globalThis.platformatic?.events.emitAndNotify('close:handler')
  server.close()
})

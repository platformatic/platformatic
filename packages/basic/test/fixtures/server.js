import { createServer } from 'node:http'

function handler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ...globalThis.platformatic, events: undefined, prometheus: undefined, itc: undefined }))
}

createServer(handler).listen({ host: '127.0.0.1', port: 10000 })

globalThis[Symbol.for('plt.children.itc')].notify('config', { production: process.env.NODE_ENV === 'production' })

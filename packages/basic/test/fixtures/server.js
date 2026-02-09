import { createServer } from 'node:http'

function handler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  const { events, prometheus, itc, clientSpansAls, telemetryReady, tracerProvider, ...platformatic } = globalThis.platformatic

  res.end(JSON.stringify(platformatic))
}

createServer(handler).listen({ host: '127.0.0.1', port: 10000 })

globalThis[Symbol.for('plt.children.itc')].notify('config', { production: process.env.NODE_ENV === 'production' })

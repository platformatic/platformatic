import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getHost, getPort, getWorkerId } from '@platformatic/globals'
import { createServer } from 'node:http'

const prefix = getBasePath({ throwOnMissing: false }) ?? ''

const server = createServer((req, res) => {
  if (req.url === ensureTrailingSlash(cleanBasePath(prefix))) {
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

const host: unknown = getHost()
const port: unknown = getPort()

server.listen({
  host: typeof host === 'string' ? host : '127.0.0.1',
  port: typeof port === 'number' ? port : 0
})

// @ts-expect-error
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getWorkerId } from '@platformatic/globals'
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

server.listen(0)

// @ts-expect-error
import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { createServer } from 'node:http'

// @ts-expect-error
const prefix = globalThis.platformatic?.basePath ?? ''

const server = createServer((req, res) => {
  if (req.url === ensureTrailingSlash(cleanBasePath(prefix))) {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
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

// This would likely fail if our code doesn't work
server.listen(1)

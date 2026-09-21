import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath } from '@platformatic/globals'
import { createServer } from 'node:http'

export function create () {
  const prefix = getBasePath({ throwOnMissing: false }) ?? ''

  return createServer((req, res) => {
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
}

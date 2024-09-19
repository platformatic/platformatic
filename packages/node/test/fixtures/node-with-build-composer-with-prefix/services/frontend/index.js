import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { createServer } from 'node:http'

export function build () {
  const prefix = globalThis.platformatic?.basePath ?? ''
  console.log('prefix', prefix)

  return createServer((req, res) => {
    console.log('url', req.url)
    if (req.url === ensureTrailingSlash(cleanBasePath(prefix))) {
      res.writeHead(200, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
    } else if (req.url === cleanBasePath(`${prefix}/direct`)) {
      res.writeHead(200, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ ok: true }))
    } else if (req.url === cleanBasePath(`${prefix}/time`)) {
      fetch('http://backend.plt.local/time')
        .then(response => response.json())
        .then(json => {
          res.writeHead(200, {
            'content-type': 'application/json',
            connection: 'close'
          })
          res.end(JSON.stringify(json))
        })
    } else {
      res.writeHead(404, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ ok: false }))
    }
  })
}

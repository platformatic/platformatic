import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  const prefix = globalThis.platformatic?.basePath ?? ''

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

// This would likely fail if our code doesn't work
server.listen(1)

import { createServer } from 'node:http'

export function build () {
  globalThis.platformatic?.setBasePath('/nested/base/dir')

  return createServer((req, res) => {
    if (req.url === '/nested/base/dir/') {
      res.writeHead(200, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
    } else if (req.url === '/nested/base/dir/direct') {
      res.writeHead(200, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({ ok: true }))
    } else if (req.url === '/nested/base/dir/time') {
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

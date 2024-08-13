import { createServer } from 'node:http'

export function build () {
  return createServer((req, res) => {
    if (req.url === '/direct') {
      res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
      res.end(JSON.stringify({ ok: true }))
    } else if (req.url === '/mesh') {
      fetch('http://main.plt.local/direct')
        .then(response => response.json())
        .then(json => {
          res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
          res.end(JSON.stringify({ ok: true }))
        })
    } else {
      res.writeHead(404, { 'content-type': 'application/json', connection: 'close' })
      res.end(JSON.stringify({ ok: false }))
    }
  })
}

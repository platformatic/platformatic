import { createServer } from 'node:http'

export function create () {
  return createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ backend: true, url: req.url }))
  })
}

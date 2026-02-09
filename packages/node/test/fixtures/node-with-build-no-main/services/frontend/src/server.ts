import { createServer } from 'node:http'

export function create () {
  return createServer((req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
  })
}

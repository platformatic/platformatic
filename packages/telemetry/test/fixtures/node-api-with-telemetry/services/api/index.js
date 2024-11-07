import { createServer } from 'node:http'

export function build () {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ foo: 'bar' }))
  })
  return server
}

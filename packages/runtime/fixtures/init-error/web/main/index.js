import { createServer } from 'node:http'

export function create () {
  return createServer((_, res) => {
    globalThis.platformatic.logger.debug('Serving request.')
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify({ hello: 'world' }))
  })
}

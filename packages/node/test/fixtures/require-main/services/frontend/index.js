import { createServer } from 'node:http'

export function create () {
  return createServer((_, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ isMain: import.meta.main }))
  })
}

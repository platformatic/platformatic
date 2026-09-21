import { createServer } from 'node:http'

export function create () {
  return createServer((_, res) => {
    res.end('ok')
  })
}

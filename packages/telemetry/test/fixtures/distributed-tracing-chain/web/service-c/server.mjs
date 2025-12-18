import { createServer } from 'node:http'

export function build () {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      service: 'service-c',
      message: 'End of the chain'
    }))
  })

  return server
}

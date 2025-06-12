import { createServer } from 'node:http'

function invokeIPC(service, req, res) {
  globalThis.platformatic.messaging
    .send(service, 'request', req.url)
    .then(url => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ url }))
    })
    .catch(err => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })
}

export function build() {
  return createServer((req, res) => {
    if (req.url === '/esm') {
      invokeIPC('ipc-esm', req, res)
    } else {
      invokeIPC('ipc-cjs', req, res)
    }
  })
}

import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer } from 'node:http'

export function create () {
  const value = 'Hello, World!'
  const store = new AsyncLocalStorage()
  store.enterWith(value)

  return createServer((_req, res) => {
    const found = store.getStore()
    if (found !== value) {
      res.writeHead(404, {
        'content-type': 'application/json',
        connection: 'close'
      })
      res.end(JSON.stringify({
        error: 'Not found'
      }))
      return
    }

    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({
      value: found
    }))
  })
}

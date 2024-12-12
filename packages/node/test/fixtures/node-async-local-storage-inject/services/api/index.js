import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer } from 'node:http'

const store = new AsyncLocalStorage()

store.run('Hello, World!', () => {
  const server = createServer((_req, res) => {
    const value = store.getStore()
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })

    res.end(JSON.stringify({
      value
    }))
  })

  server.listen(3000)
})

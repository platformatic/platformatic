import { createServer } from 'node:http'

createServer().listen({ host: '127.0.0.1', port: 0 })

setTimeout(() => {
  process.exit(123)
}, 100)

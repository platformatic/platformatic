import { createServer } from 'node:http'

createServer((_, res) => res.end()).listen({ host: '127.0.0.1', port: 0 })

setTimeout(() => {
  process.kill(process.pid, 'SIGABRT')
}, 100)

import { getITC, registerCloseCallback } from '@platformatic/globals'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { isMainThread, Worker } from 'node:worker_threads'

const server = createServer((_, response) => response.end('ok'))
const itc = getITC()
let worker

registerCloseCallback(async () => {
  await worker?.terminate()
  await server[Symbol.asyncDispose]()
})

if (isMainThread) {
  itc.handle('startInternalServer', () => {
    worker = new Worker(new URL(import.meta.url))
  })
}

server.listen({ host: '127.0.0.1', port: 0 })
await once(server, 'listening')

if (!isMainThread) {
  // Use the same IPC connection as URL notifications to preserve their order.
  itc.notify('internal:listening')
}

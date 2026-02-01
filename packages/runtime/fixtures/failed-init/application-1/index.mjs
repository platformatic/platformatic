import fastify from 'fastify'
import { parentPort } from 'node:worker_threads'

export function create () {
  const app = fastify()

  setTimeout(() => {
    parentPort.removeAllListeners('message')
    globalThis.platformatic.events.emitAndNotify('mesh-removed')
  }, 500)

  return app
}

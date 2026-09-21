import { getEvents, getITC } from '@platformatic/globals'
import fastify from 'fastify'
import { parentPort } from 'node:worker_threads'

export function create () {
  const app = fastify()
  const events = getEvents()
  const itc = getITC()

  // Once the runtime acknowledges us as started, hijack the parentPort to prevent other applications
  // to properly start up.
  itc.on('runtime:event', ({ event }) => {
    if (event === 'application:worker:started') {
      parentPort.removeAllListeners('message')
      events.emitAndNotify('mesh-removed')
    }
  })

  return app
}

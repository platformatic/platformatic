import fastify from 'fastify'
import { parentPort } from 'node:worker_threads'

export function create () {
  const app = fastify()

  // Once the runtime acknowledges us as started, hijack the parentPort to prevent other applications
  // to properly start up.
  globalThis[Symbol.for('plt.runtime.itc')]?.on('runtime:event', ({ event }) => {
    if (event === 'application:worker:started') {
      parentPort.removeAllListeners('message')
      globalThis.platformatic.events.emitAndNotify('mesh-removed')
    }
  })

  return app
}

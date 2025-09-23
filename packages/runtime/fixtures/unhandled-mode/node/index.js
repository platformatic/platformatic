import fastify from 'fastify'
import { setTimeout as sleep } from 'node:timers/promises'

process.on('unhandledRejection', () => {
  globalThis.platformatic.events.emitAndNotify('unhandledRejection')
})

async function trigger () {
  await sleep(500)
  throw new Error('UNHANDLED')
}

const app = fastify()

app.get('/trigger', async () => {
  trigger()
  return { ok: true }
})

app.listen({ port: 0 })

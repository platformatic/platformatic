import { getEvents } from '@platformatic/globals'
import fastify from 'fastify'
import { setTimeout as sleep } from 'node:timers/promises'

process.on('unhandledRejection', () => {
  const events = getEvents()
  events.emitAndNotify('unhandledRejection')
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

app.get('/listeners', async () => {
  return { count: process.listeners('unhandledRejection').length }
})

app.listen({ port: 0 })

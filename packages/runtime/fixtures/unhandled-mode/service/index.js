import { getEvents } from '@platformatic/globals'
process.on('uncaughtException', () => {
  const events = getEvents()
  events.emitAndNotify('uncaughtException')
})

export default async function (fastify) {
  fastify.get('/listeners', async () => {
    return { count: process.listeners('uncaughtException').length }
  })

  fastify.get('/trigger', async () => {
    setTimeout(() => {
      throw new Error('UNHANDLED')
    }, 500)

    return { ok: true }
  })
}

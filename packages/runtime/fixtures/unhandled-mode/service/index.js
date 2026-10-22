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

  fastify.get('/trigger-rejections', async () => {
    setTimeout(() => {
      // The first rejection stops the application successfully, which leaves its controller no
      // longer started. The stop attempted for the second one therefore rejects.
      Promise.reject(new Error('UNHANDLED'))
      setTimeout(() => Promise.reject(new Error('UNHANDLED')), 50)
    }, 500)

    return { ok: true }
  })
}

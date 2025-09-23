process.on('uncaughtException', () => {
  globalThis.platformatic.events.emitAndNotify('uncaughtException')
})

export default async function (fastify) {
  fastify.get('/trigger', async () => {
    setTimeout(() => {
      throw new Error('UNHANDLED')
    }, 500)

    return { ok: true }
  })
}

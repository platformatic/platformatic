process.on('uncaughtException', () => {
  globalThis[Symbol.for('plt.runtime.itc')].notify('event', { event: 'uncaughtException' })
})

export default async function (fastify) {
  fastify.get('/trigger', async () => {
    setTimeout(() => {
      throw new Error('UNHANDLED')
    }, 500)

    return { ok: true }
  })
}

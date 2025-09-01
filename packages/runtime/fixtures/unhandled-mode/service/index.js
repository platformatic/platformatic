'use strict'

process.on('uncaughtException', error => {
  globalThis[Symbol.for('plt.runtime.itc')].notify('event', { event: 'uncaughtException', payload: error })
})

module.exports = async function (fastify) {
  fastify.get('/trigger', async () => {
    setTimeout(() => {
      throw new Error('UNHANDLED')
    }, 500)

    return { ok: true }
  })
}

'use strict'

process.on('uncaughtException', () => {})

module.exports = async function (fastify) {
  fastify.get('/trigger', async () => {
    setTimeout(() => {
      throw new Error('UNHANDLED')
    }, 500)

    return { ok: true }
  })
}

'use strict'

module.exports = async function (fastify) {
  fastify.get('/alpha', async () => {
    return { from: 'alpha' }
  })

  let counter = 0
  fastify.get('/counter', async () => {
    return { counter: counter++ }
  })

  fastify.get('/shared-context', async () => {
    return globalThis.platformatic.sharedContext.get()
  })
}

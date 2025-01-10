'use strict'

module.exports = async function (fastify) {
  fastify.get('/preload', async () => {
    return { value: globalThis.value }
  })

  fastify.get('/node-options', async () => {
    return { pid: process.pid, value: process.env.NODE_OPTIONS }
  })
}

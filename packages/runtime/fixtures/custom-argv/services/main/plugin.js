'use strict'

module.exports = async function (fastify) {
  fastify.get('/', async () => {
    return process.argv
  })
}

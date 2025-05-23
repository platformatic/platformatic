module.exports = async function (fastify) {
  fastify.get('/', async () => {
    fastify.log.debug({ secret: 'foo' }, 'call route / on service')
    return 'ok'
  })
}

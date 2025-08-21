export default async function  (fastify) {
  fastify.get('/logs', async () => {
    fastify.log.debug({ secret: 'foo' }, 'call route /logs')
    return 'ok'
  })
}

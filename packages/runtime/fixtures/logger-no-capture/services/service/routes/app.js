export default async function (fastify) {
  fastify.get('/', async req => {
    fastify.log.debug({ req }, 'call route / on service')
    return 'ok'
  })
}

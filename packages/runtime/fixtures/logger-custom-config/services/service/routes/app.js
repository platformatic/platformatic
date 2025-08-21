export default async function  (fastify) {
  fastify.get('/', async req => {
    fastify.log.verbose({ req }, 'call route / on service')
    return 'ok'
  })
}

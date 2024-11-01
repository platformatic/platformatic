export default async function (fastify) {
  fastify.decorate('example', 'foobar')
}

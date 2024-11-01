module.export = async function (fastify) {
  fastify.decorate('example', 'foobar')
}

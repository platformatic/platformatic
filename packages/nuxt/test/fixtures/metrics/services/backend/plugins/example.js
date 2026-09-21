module.exports = async function (fastify) {
  fastify.decorate('example', 'foobar')
}

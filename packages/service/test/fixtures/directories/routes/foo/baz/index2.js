/*
 * Used for providing an alternative `index.js` naming convention
 * when specified from the autoload `indexPattern` property.
 */
export default async function (fastify, opts) {
  fastify.get('/index2', async function (request, reply) {
    return { hello: 'from baz with index2.js' }
  })
}

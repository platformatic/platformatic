'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
export default async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
module.exports[Symbol.for('skip-override')] = true

export { handler } from './wrapping-handler.js'

export default function (request, reply) {
  return reply.code(500).send('The named handler should take precedence.')
}

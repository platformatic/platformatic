export { handler as default } from './wrapping-handler.js'

export function handler (context, request, reply) {
  return reply.code(500).send('The default handler should take precedence.')
}

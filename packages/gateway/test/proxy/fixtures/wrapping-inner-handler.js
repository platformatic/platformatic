import { states } from './wrapping-handler.js'

export function handler (request, reply, dest, options) {
  const state = states.get(request.server.listeningOrigin)
  state.inner++
  return reply.from(dest, options)
}

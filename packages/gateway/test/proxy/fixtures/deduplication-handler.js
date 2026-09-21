export function handler (_request, reply, dest, options) {
  return reply.from(dest, {
    ...options,
    async onResponse (request, reply, res) {
      reply.header('x-deduplication-handler', 'true')
      return options.deduplicateResponse(request, reply, res)
    }
  })
}

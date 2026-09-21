export function handler (request, reply, dest, options) {
  return reply.send({
    url: request.url,
    dest,
    hasRewriteHeaders: typeof options.rewriteHeaders === 'function'
  })
}

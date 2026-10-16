// Routes only when request.body arrived parsed. With @fastify/http-proxy's
// catch-all parsers in place the body is a stream, and this throws instead.
export default function createProxyHooks (options) {
  return {
    getUpstream (request) {
      if (request.method === 'POST' && typeof request.body?.pipe === 'function') {
        throw new Error('the body reached getUpstream unparsed')
      }

      return options.upstream
    }
  }
}

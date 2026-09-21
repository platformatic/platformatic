export default function createWsRouter (options) {
  const headerName = options.header ?? 'x-version'

  return {
    getUpstream (request) {
      const target = request.headers[headerName]

      return options.upstreams[target] ?? options.upstreams.default
    }
  }
}

export function platformaticHttp2HeadersPlugin () {
  return {
    name: 'platformatic-http2-headers',
    apply: 'serve',
    enforce: 'pre',

    configureServer (server) {
      server.middlewares.use((req, _res, next) => {
        if (req.httpVersionMajor < 2) {
          next()
          return
        }

        const headers = { ...req.headers }
        const authority = headers[':authority']

        if (authority && !headers.host) {
          headers.host = authority
        }

        for (const key of Object.keys(headers)) {
          if (key.startsWith(':')) {
            delete headers[key]
          }
        }

        Object.defineProperty(req, 'headers', {
          configurable: true,
          value: headers
        })
        next()
      })
    }
  }
}

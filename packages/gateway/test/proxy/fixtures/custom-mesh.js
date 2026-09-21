function parseCookies (header) {
  const cookies = {}

  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=')

    if (index === -1) {
      continue
    }

    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }

  return cookies
}

// Routes each request to a runtime application chosen via a request header or
// a cookie. The returned upstreams use the runtime mesh (http://<id>.plt.local)
// and the target applications are purposely NOT listed in the gateway
// applications configuration.
export default function createVersionRouter (options) {
  const headerName = options.header ?? 'x-version'
  const cookieName = options.cookie ?? 'version'

  return {
    getUpstream (request) {
      const version = request.headers[headerName] ?? parseCookies(request.headers.cookie)[cookieName]

      if (version) {
        return `http://${version}.plt.local`
      }

      return `http://${options.fallback}.plt.local`
    }
  }
}

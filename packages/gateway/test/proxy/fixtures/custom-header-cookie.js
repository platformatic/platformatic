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

// The module exports a factory: it receives proxy.custom.options from the
// gateway configuration and returns the hooks object.
export default function createProxyHooks (options) {
  const headerName = options.header ?? 'x-upstream'
  const cookieName = options.cookie ?? 'upstream'
  const upstreams = options.upstreams ?? {}

  return {
    getUpstream (request, base) {
      let selected = request.headers[headerName]

      if (!selected) {
        selected = parseCookies(request.headers.cookie)[cookieName]
      }

      if (selected && upstreams[selected]) {
        request.selectedUpstream = selected
        return upstreams[selected]
      }

      return options.fallback ?? base
    },
    rewriteHeaders (headers, request) {
      if (request.selectedUpstream) {
        headers['set-cookie'] = `${cookieName}=${request.selectedUpstream}; Path=/`
      }

      return headers
    }
  }
}

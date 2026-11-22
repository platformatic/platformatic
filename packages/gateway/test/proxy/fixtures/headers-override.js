export default function (options) {
  function getHeadersOverride (request) {
    if (options.invalid !== undefined) {
      return { response: { 'x-invalid': options.invalid } }
    }
    const client = request.headers['x-client']
    if (options.remove) {
      return {
        request: { Cookie: null, 'X-Forwarded-Host': 'hook.example.com' },
        response: client === 'strip' ? { 'Set-Cookie': null, 'X-Client': null } : {}
      }
    }
    return {
      request: {
        'X-Override': request.headers['x-validated'],
        ...(options.cookie ? { cookie: `session=${client}` } : {})
      },
      response: client === 'none'
        ? {}
        : {
            'X-Client': client,
            'Set-Cookie': [`session=${client}; Path=/; HttpOnly`, `variant=${client}; Path=/`]
          }
    }
  }

  return {
    preValidation (request, reply, done) {
      request.headers['x-validated'] = 'validated'
      done()
    },
    getHeadersOverride: options.async ? async request => getHeadersOverride(request) : getHeadersOverride,
    rewriteHeaders (headers) {
      return { ...headers, 'x-client': 'rewritten', 'set-cookie': ['upstream=rewritten; Path=/'] }
    },
    ...(options.invalidHandler ? { [options.invalidHandler]: false } : {})
  }
}

export default function (options) {
  function getHeadersOverride (request) {
    if (options.invalid) {
      return { response: { 'x-invalid': 42 } }
    }
    const client = request.headers['x-client']
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

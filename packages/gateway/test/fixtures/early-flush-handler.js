const prefix = '<!doctype html><html><head><title>Shared</title></head><body><main>'

export default function handler (request, reply, dest, options) {
  if (request.headers['x-custom']) {
    return reply.type(request.headers['x-change-type'] ? 'text/plain' : 'text/html').send(prefix + 'custom')
  }
  return reply.from(dest, options)
}

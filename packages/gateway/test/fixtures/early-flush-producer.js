import { Readable } from 'node:stream'

const prefix = '<!doctype html><html><head><title>Shared</title></head><body><main>'

export default {
  handler (request, reply) {
    return reply.type('text/plain').send('legacy')
  },
  acquireResponse (request) {
    const id = request.url.split('/').at(-1)
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      stream: Readable.from([`${prefix}${id}</main></body></html>`])
    }
  }
}

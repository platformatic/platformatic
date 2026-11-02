const prefix = '<!doctype html><html><head><title>Shared</title></head><body><main>'

export default function handler (request, reply) {
  const kind = request.headers['x-payload']
  if (kind === 'null' || kind === 'null-text') {
    if (kind === 'null-text') {
      reply.type('text/plain')
    }
    return reply.send(null)
  }
  if (kind === 'undefined') {
    return reply.send()
  }

  const html = `${prefix}${request.url.split('/').at(-1)}</main></body></html>`
  const buffer = Buffer.from(`ignored${html}ignored`)
  const offset = buffer.byteOffset + Buffer.byteLength('ignored')
  const length = Buffer.byteLength(html)
  if (kind === 'html') {
    reply.type('text/html')
  }
  const payload = kind === 'data-view'
    ? new DataView(buffer.buffer, offset, length)
    : new Uint8Array(buffer.buffer, offset, length)
  return reply.send(payload)
}

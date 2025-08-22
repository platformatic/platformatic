import fp from 'fastify-plugin'
import { join } from 'path'
import protobuf from 'protobufjs'

// Protobuf setup to correctly decode messages
async function plugin (fastify, opts) {
  const traceProtoPath = join('opentelemetry/proto/trace/v1/trace.proto')

  // Considering that we just process socket ports and HTTP status codes, we don't need Long.
  // (otherwise we get Long instances instead of numbers).
  // See: https://github.com/protobufjs/protobuf.js/issues/1109#issuecomment-789711134
  protobuf.util.Long = undefined
  protobuf.configure()

  // This must point where the `opentelemetry` folder is located
  const root = new protobuf.Root()
  root.resolvePath = (_origin, target) => {
    return join(import.meta.dirname, target)
  }
  root.loadSync(traceProtoPath)
  root.resolveAll()
  const tracePackage = root.lookupType('opentelemetry.proto.trace.v1.TracesData')
  const spanKind = root.lookupEnum('opentelemetry.proto.trace.v1.Span.SpanKind')
  const { SPAN_KIND_SERVER, SPAN_KIND_CLIENT, SPAN_KIND_INTERNAL } = spanKind.values

  fastify.decorate('messages', {
    tracePackage,
    SpanKind: {
      SPAN_KIND_CLIENT,
      SPAN_KIND_SERVER,
      SPAN_KIND_INTERNAL
    }
  })

  fastify.addContentTypeParser('application/x-protobuf', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const spans = tracePackage.decode(body)
      return done(null, spans)
    } catch (err) {
      return done(err)
    }
  })
}

export default fp(plugin, { name: 'messages' })

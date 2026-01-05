import { context, trace } from '@opentelemetry/api'
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'

export function build () {
  let count = 0
  const server = createServer((req, res) => {
    // DEBUG: Log request details and OpenTelemetry context
    const activeContext = context.active()
    const activeSpan = trace.getSpan(activeContext)
    const spanContext = activeSpan?.spanContext()

    const debugInfo = {
      timestamp: Date.now(),
      url: req.url,
      headers: req.headers,
      hasActiveContext: activeContext !== undefined,
      hasActiveSpan: activeSpan !== undefined,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      tracerProviderExists: !!globalThis.platformatic?.tracerProvider
    }

    try {
      appendFileSync('/tmp/node-service-debug.log', JSON.stringify(debugInfo) + '\n')
    } catch (e) {
      // Ignore
    }

    console.log('received request', req.headers)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ content: `from node:http createServer: ${count++}!` }))
  })
  return server
}

'use strict'

const { trace } = require('@opentelemetry/api')
const { request } = require('undici')

module.exports = async function (fastify, opts) {
  // This returns the traceId set on the span by the service
  // Uses OpenTelemetry API to get active span (works with both manual and automatic instrumentation)
  fastify.get('/', async (req, reply) => {
    const activeSpan = trace.getActiveSpan()
    const traceId = activeSpan?.spanContext()?.traceId
    return { traceId }
  })

  fastify.get('/service-1/echo-headers', async (req, reply) => {
    const res = await request('http://service-1.plt.local/echo-headers', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
    })
    const body = await res.body.json()
    return body
  })
}

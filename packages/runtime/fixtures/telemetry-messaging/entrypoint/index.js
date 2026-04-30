'use strict'

const { context, trace } = require('@opentelemetry/api')
const { createServer } = require('node:http')

function writeJson (res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json'
  })
  res.end(JSON.stringify(payload))
}

function getPathValue (pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return null
  }

  return decodeURIComponent(pathname.slice(prefix.length))
}

module.exports.create = function create () {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    try {
      if (req.method === 'GET') {
        const sendValue = getPathValue(url.pathname, '/send/')
        if (sendValue !== null && sendValue !== '') {
          const response = await globalThis.platformatic.messaging.send('ipc', 'reverse', sendValue)
          return writeJson(res, 200, response)
        }

        const sendManualValue = getPathValue(url.pathname, '/send-manual/')
        if (sendManualValue !== null && sendManualValue !== '') {
          const telemetryMetadata = {}
          const traceparent = req.headers['x-manual-traceparent'] ?? req.headers.traceparent
          const tracestate = req.headers['x-manual-tracestate'] ?? req.headers.tracestate

          if (typeof traceparent === 'string') {
            telemetryMetadata.traceparent = traceparent
          }

          if (typeof tracestate === 'string') {
            telemetryMetadata.tracestate = tracestate
          }

          const response = await globalThis.platformatic.messaging.send('ipc', 'reverse', sendManualValue, {
            telemetryMetadata
          })

          return writeJson(res, 200, response)
        }

        if (url.pathname === '/fail') {
          try {
            await globalThis.platformatic.messaging.send('ipc', 'fail')
            return writeJson(res, 200, { ok: true })
          } catch (error) {
            return writeJson(res, 500, { message: error.message })
          }
        }

        if (url.pathname === '/trace-id') {
          const span = trace.getSpan(context.active())
          return writeJson(res, 200, {
            traceId: span?.spanContext()?.traceId
          })
        }
      }

      return writeJson(res, 404, { message: 'Not found' })
    } catch (error) {
      return writeJson(res, 500, { message: error.message })
    }
  })
}

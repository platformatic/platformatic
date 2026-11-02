import { stringify } from 'node:querystring'
import { setTimeout as delay } from 'node:timers/promises'
import { EarlyFlushUpstreamError } from './errors.js'

// Neither request pseudo-headers nor hop-by-hop fields belong to a new HTTP exchange.
function transportHeaders (values) {
  const excluded = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade',
    ...String(values.connection ?? '').toLowerCase().split(',').map(name => name.trim())
  ])
  return Object.fromEntries(Object.entries(values).filter(([name]) => !name.startsWith(':') && !excluded.has(name.toLowerCase())))
}

/**
 * Fetch upstream metadata and a byte stream without touching the client reply.
 * The consumer owns the returned stream. Client disconnects must not abort this exchange:
 * deduplication may still need to consume it for other clients.
 */
export function createProxyResponse ({ app, dispatcher, upstream }) {
  return async function acquireResponse (request, dest, options) {
    let stream
    try {
      const origin = options.getUpstream ? options.getUpstream(request, upstream) : upstream
      const url = new URL(dest, origin)
      const query = options.queryString
      if (typeof query === 'function') {
        url.search = query(url.search, request.raw.url, request)
      } else if (query) {
        url.search = stringify(query)
      } else if (!url.search) {
        const index = request.raw.url.indexOf('?')
        url.search = index === -1 ? '' : request.raw.url.slice(index)
      }

      let headers = transportHeaders(request.headers)
      headers.host = url.host
      let body = request.body
      // Parsed JSON includes primitives and null, not just objects. Raw buffers and streams
      // already contain wire bytes; re-encode parsed values and recompute their byte length.
      const contentType = String(headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
      if (body !== undefined && typeof body?.pipe !== 'function' && !Buffer.isBuffer(body)) {
        if (contentType === 'application/json' || contentType.endsWith('+json') || (body !== null && typeof body === 'object')) {
          body = JSON.stringify(body)
        }
        if (typeof body === 'string') {
          headers['content-length'] = Buffer.byteLength(body)
        }
      } else if (Buffer.isBuffer(body)) {
        headers['content-length'] = Buffer.byteLength(body)
      }
      headers = options.rewriteRequestHeaders?.(request, headers) ?? headers

      const requestOptions = {
        origin: url.origin,
        path: url.pathname + url.search,
        method: request.method,
        headers,
        body,
        headersTimeout: options.timeout,
        bodyTimeout: options.timeout
      }
      let response
      // Preserve reply-from's default retries for bodyless GET responses reporting 503.
      // Consume each rejected response before reusing the dispatcher connection.
      for (let attempt = 0; ; attempt++) {
        response = await dispatcher.request(requestOptions)
        if (request.method !== 'GET' || headers['content-length'] || response.statusCode !== 503 || attempt >= 10) {
          break
        }
        await response.body.dump()
        await delay(Number(response.headers['retry-after'] ?? (42 * Math.random() * (attempt + 1))))
      }
      stream = response.body
      // Metadata validation or cancellation can dispose of the body before a reader attaches.
      stream.on('error', () => {})
      const responseHeaders = options.rewriteHeaders?.(response.headers, request) ?? response.headers
      app.openTelemetry?.endHTTPSpanClient(request.proxedCallSpan, {
        statusCode: response.statusCode,
        headers: response.headers
      })
      return { statusCode: response.statusCode, headers: transportHeaders(responseHeaders), stream }
    } catch (cause) {
      stream?.destroy()
      throw new EarlyFlushUpstreamError('request', { cause })
    }
  }
}

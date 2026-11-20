import { validateHeaderName, validateHeaderValue } from 'node:http'
import { InvalidHeadersOverrideError } from './errors.js'

export const kHeadersOverride = Symbol('plt.gateway.headersOverride')

function normalizeHeaders (headers) {
  if (headers === undefined) {
    return {}
  }
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new InvalidHeadersOverrideError()
  }

  const normalized = Object.create(null)
  for (const [name, value] of Object.entries(headers)) {
    validateHeaderName(name)
    const values = Array.isArray(value) ? value : [value]
    if (!values.length || values.some(value => typeof value !== 'string')) {
      throw new InvalidHeadersOverrideError()
    }
    for (const value of values) {
      validateHeaderValue(name, value)
    }
    normalized[name.toLowerCase()] = Array.isArray(value) ? [...value] : value
  }
  return normalized
}

function rewriteHeadersOverride (request, reply, headers) {
  const state = request[kHeadersOverride]
  if (!state) {
    return headers
  }

  // Retain metadata before per-client overrides so a deduplicated response cannot replay them.
  state.baseHeaders = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  applyResponseHeadersOverride(request, reply)

  // reply-from copies the returned headers onto reply. Omit overrides already applied through
  // Fastify so upstream values cannot replace them or append duplicate Set-Cookie values.
  const remaining = { ...state.baseHeaders }
  for (const name of Object.keys(state.response)) {
    delete remaining[name]
  }
  return remaining
}

export function applyResponseHeadersOverride (request, reply) {
  for (const [name, value] of Object.entries(request[kHeadersOverride]?.response ?? {})) {
    // Fastify appends Set-Cookie by default; an override replaces the complete header value.
    reply.removeHeader(name)
    reply.header(name, value)
  }
}

export async function prepareHeadersOverride (getHeadersOverride, request, reply) {
  let requestHeaders
  let responseHeaders

  try {
    const result = await getHeadersOverride(request)
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new InvalidHeadersOverrideError()
    }
    requestHeaders = normalizeHeaders(result.request)
    responseHeaders = normalizeHeaders(result.response)
  } catch {
    throw new InvalidHeadersOverrideError()
  }

  // Resolve both maps before mutating the request. Wrappers and deduplication see the overrides.
  request.headers = requestHeaders
  request[kHeadersOverride] = { request: requestHeaders, response: responseHeaders }

  // Make response overrides available to handlers that send output before the upstream responds.
  applyResponseHeadersOverride(request, reply)
}

export function headersOverrideHandler (next, request, reply, destination, options) {
  // Capture this reply in the per-request callback, without retaining it in request state.
  const proxyOptions = {
    ...options,
    rewriteRequestHeaders (request, headers) {
      // reply-from starts from raw headers, whereas Fastify's setter keeps overrides separately.
      const overridden = { ...headers, ...request[kHeadersOverride].request }
      if (options.rewriteRequestHeaders) {
        return options.rewriteRequestHeaders(request, overridden)
      }
      return overridden
    },
    rewriteHeaders (headers, request) {
      const rewritten = options.rewriteHeaders ? options.rewriteHeaders(headers, request) : headers
      return rewriteHeadersOverride(request, reply, rewritten)
    }
  }

  return next(request, reply, destination, proxyOptions)
}

export function sharedResponseHeaders (request, headers) {
  const state = request[kHeadersOverride]
  if (!state) {
    return headers
  }

  const shared = { ...headers }
  for (const name of Object.keys(state.response)) {
    delete shared[name]
    if (state.baseHeaders?.[name] !== undefined) {
      shared[name] = state.baseHeaders[name]
    }
  }
  return shared
}

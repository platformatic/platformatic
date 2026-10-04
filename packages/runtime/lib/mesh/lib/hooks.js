'use strict'

const diagnosticsChannel = require('node:diagnostics_channel')

const supportedHooks = [
  'onChannelCreation',
  'onServerRequest',
  'onServerResponse',
  'onServerError',
  'onClientRequest',
  'onClientResponse',
  'onClientResponseEnd',
  'onClientError'
]

// Undici diagnostics_channel channels
const channels = {
  create: diagnosticsChannel.channel('undici:request:create'),
  headers: diagnosticsChannel.channel('undici:request:headers'),
  trailers: diagnosticsChannel.channel('undici:request:trailers'),
  error: diagnosticsChannel.channel('undici:request:error')
}

// Symbol to store wrapped request on context
const kWrappedRequest = Symbol('wrappedRequest')

/**
 * Create a Request-like wrapper that matches undici's Request interface
 * so @opentelemetry/instrumentation-undici can instrument it
 */
function createRequestWrapper (req) {
  // Convert headers object to array format [k1, v1, k2, v2, ...]
  const headersArray = []
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) headersArray.push(key, v)
      } else {
        headersArray.push(key, value)
      }
    }
  }

  // Extract host from origin
  const originUrl = new URL(req.origin)

  return {
    origin: req.origin,
    method: req.method || 'GET',
    path: req.path,
    headers: headersArray,
    host: req.headers?.host || originUrl.host,
    // CRITICAL: addHeader is called by OTel instrumentation to inject trace context
    addHeader (name, value) {
      this.headers.push(name, value)
      // Also update the original request headers so they're actually sent
      req.headers = req.headers || {}
      req.headers[name] = value
    },
    completed: false,
    aborted: false,
    idempotent: ['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET'),
    contentLength: null,
    contentType: req.headers?.['content-type'] || null,
    body: req.body || null
  }
}

/**
 * Convert response headers to array format if needed
 */
function convertResponseHeaders (headers) {
  if (!headers) return []

  // If already array, return as-is
  if (Array.isArray(headers)) return headers

  // Convert object to array format
  const result = []
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) result.push(key, v)
    } else {
      result.push(key, value)
    }
  }
  return result
}

class Hooks {
  onChannelCreation = []
  onServerRequest = []
  onServerResponse = []
  onServerError = []
  onClientRequest = []
  onClientResponse = []
  onClientResponseEnd = []
  onClientError = []

  constructor (opts) {
    for (const hook of supportedHooks) {
      const value = opts?.[hook]
      if (value) {
        this[hook] = this.#normalizeHook(value)
      }
    }
  }

  #normalizeHook (hook) {
    const hooks = Array.isArray(hook) ? hook : [hook]
    for (const h of hooks) {
      this.#validateHook(h)
    }
    return hooks
  }

  #validateHook (hook) {
    if (typeof hook !== 'function') throw new Error(`Expected a function, got ${typeof hook}`)
    const isAsync = hook.constructor.name === 'AsyncFunction'
    if (isAsync) throw new Error('Async hooks are not supported')
  }

  fireOnChannelCreation (first, second) {
    for (const hook of this.onChannelCreation) {
      if (hook(first, second) === false) {
        return false
      }
    }

    return true
  }

  fireOnServerRequest (req, cb) {
    // Chain onServerRequest hooks properly
    let index = 0
    const hooks = this.onServerRequest

    if (hooks.length === 0) {
      cb()
      return
    }

    const next = () => {
      if (index >= hooks.length) {
        cb()
        return
      }
      const hook = hooks[index++]
      hook(req, next)
    }

    next()
  }

  fireOnServerResponse (req, res) {
    for (const hook of this.onServerResponse) {
      hook(req, res)
    }
  }

  fireOnServerError (req, res, error) {
    for (const hook of this.onServerError) {
      hook(req, res, error)
    }
  }

  fireOnClientRequest (req, ctx) {
    // Define lazy getter for wrappedRequest - only construct when accessed
    // This avoids costly object construction and header restructuring when there are no subscribers
    Object.defineProperty(ctx, kWrappedRequest, {
      get () {
        // Create wrapper on first access
        const wrapper = createRequestWrapper(req)
        // Replace getter with actual value for subsequent accesses
        Object.defineProperty(ctx, kWrappedRequest, {
          value: wrapper,
          writable: true,
          configurable: true,
          enumerable: false
        })
        return wrapper
      },
      configurable: true,
      enumerable: false
    })

    // Emit undici:request:create event
    // OTel instrumentation will:
    // 1. Create a span
    // 2. Call wrappedRequest.addHeader() to inject trace context (traceparent, etc.)
    // Only access ctx[kWrappedRequest] if there are subscribers (triggers lazy construction)
    // Skip emission for HTTP proxy requests (port[kAddress] path) as those will be instrumented by undici itself
    if (channels.create.hasSubscribers && !ctx.skipDiagnosticsChannel) {
      channels.create.publish({ request: ctx[kWrappedRequest] })
    }

    // Fire user hooks
    for (const hook of this.onClientRequest) {
      hook(req, ctx)
    }
  }

  fireOnClientResponse (req, res, ctx) {
    // Emit undici:request:headers event
    // OTel instrumentation will set response status code on the span
    // Only access wrappedRequest if there are subscribers (avoids triggering lazy construction)
    // Skip emission for HTTP proxy requests (port[kAddress] path) as those will be instrumented by undici itself
    if (channels.headers.hasSubscribers && !ctx.skipDiagnosticsChannel) {
      const wrappedRequest = ctx[kWrappedRequest]
      if (wrappedRequest) {
        channels.headers.publish({
          request: wrappedRequest,
          response: {
            statusCode: res.statusCode,
            headers: convertResponseHeaders(res.headers),
            statusText: res.statusText || ''
          }
        })
      }
    }

    // Fire user hooks
    for (const hook of this.onClientResponse) {
      hook(req, res, ctx)
    }
  }

  fireOnClientResponseEnd (req, res, ctx) {
    // Emit undici:request:trailers event
    // OTel instrumentation will end the span
    // Only access wrappedRequest if there are subscribers (avoids triggering lazy construction)
    // Skip emission for HTTP proxy requests (port[kAddress] path) as those will be instrumented by undici itself
    if (channels.trailers.hasSubscribers && !ctx.skipDiagnosticsChannel) {
      const wrappedRequest = ctx[kWrappedRequest]
      if (wrappedRequest) {
        wrappedRequest.completed = true
        channels.trailers.publish({
          request: wrappedRequest,
          trailers: []
        })
      }
    }

    // Fire user hooks
    for (const hook of this.onClientResponseEnd) {
      hook(req, res, ctx)
    }
  }

  fireOnClientError (req, res, ctx, error) {
    // Emit undici:request:error event
    // OTel instrumentation will record the error and end the span
    // Only access wrappedRequest if there are subscribers (avoids triggering lazy construction)
    // Skip emission for HTTP proxy requests (port[kAddress] path) as those will be instrumented by undici itself
    if (channels.error.hasSubscribers && !ctx.skipDiagnosticsChannel) {
      const wrappedRequest = ctx[kWrappedRequest]
      if (wrappedRequest) {
        channels.error.publish({
          request: wrappedRequest,
          error
        })
      }
    }

    // Fire user hooks
    for (const hook of this.onClientError) {
      hook(req, res, ctx, error)
    }
  }
}

module.exports = {
  Hooks,
  // Export for testing only
  createRequestWrapper,
  convertResponseHeaders
}

import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { RPCType, setRPCMetadata } from '@opentelemetry/core'
import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf-8'))

const supportedVersions = ['>=5.0.0 <7']
const kOriginal = Symbol('platformatic.instrumentation.light-my-request.original')

function getRequestAttributes (request) {
  const { method, url, headers } = request
  const attributes = { 'http.request.method': method, 'url.scheme': 'http' }

  // The injected request has no socket, so the authority can only come from the host header.
  let parsed
  try {
    parsed = new URL(url, `http://${headers.host ?? 'localhost'}`)
  } catch {
    attributes['url.path'] = url
    return attributes
  }

  attributes['server.address'] = parsed.hostname
  attributes['url.full'] = parsed.href
  attributes['url.path'] = parsed.pathname

  if (parsed.port) {
    attributes['server.port'] = Number(parsed.port)
  }

  if (parsed.search) {
    attributes['url.query'] = parsed.search.slice(1)
  }

  return attributes
}

function wrapDispatch (instrumentation, dispatchFunc) {
  // Leave invalid values untouched so that light-my-request reports its own validation error.
  if (typeof dispatchFunc !== 'function') {
    return dispatchFunc
  }

  function tracedDispatch (request, response) {
    if (!instrumentation.isEnabled()) {
      return dispatchFunc.call(this, request, response)
    }

    const attributes = getRequestAttributes(request)
    const parentContext = propagation.extract(context.active(), request.headers)
    const span = instrumentation.tracer.startSpan(
      `${request.method} ${attributes['url.path']}`,
      { kind: SpanKind.SERVER, attributes },
      parentContext
    )

    // The RPC metadata is the contract that framework instrumentations (like @fastify/otel) use to
    // report the matched route and to know that a SERVER span already exists for this request.
    const rpcMetadata = { type: RPCType.HTTP, span }
    const requestContext = setRPCMetadata(trace.setSpan(parentContext, span), rpcMetadata)

    let ended = false
    function endSpan () {
      if (ended) {
        return
      }
      ended = true

      if (rpcMetadata.route) {
        span.setAttribute('http.route', rpcMetadata.route)
        span.updateName(`${request.method} ${rpcMetadata.route}`)
      }

      span.setAttribute('http.response.status_code', response.statusCode)
      if (response.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR })
      }

      span.end()
    }

    // A destroyed response only emits "close", a completed one emits both.
    response.once('finish', endSpan)
    response.once('close', endSpan)

    try {
      return context.with(requestContext, () => dispatchFunc.call(this, request, response))
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      endSpan()
      throw error
    }
  }

  // light-my-request detects Express applications by checking that the dispatch function is the
  // application referenced by its request prototype, then patches the request and response prototypes.
  // Mirror that shape on the wrapper, otherwise the detection would silently stop working.
  if (dispatchFunc.request?.app === dispatchFunc) {
    tracedDispatch.request = new Proxy(dispatchFunc.request, {
      get (target, property) {
        return property === 'app' ? tracedDispatch : Reflect.get(target, property)
      }
    })
    tracedDispatch.response = dispatchFunc.response
  }

  return tracedDispatch
}

function patch (instrumentation, moduleExports) {
  // CommonJS consumers receive the inject function itself, ESM ones a namespace exposing it as default.
  const isFunctionExport = typeof moduleExports === 'function'
  const original = isFunctionExport ? moduleExports : moduleExports.default

  if (original[kOriginal]) {
    return moduleExports
  }

  function inject (dispatchFunc, options, callback) {
    return original.call(this, wrapDispatch(instrumentation, dispatchFunc), options, callback)
  }

  // bindInject closes over the original inject, so it has to receive the wrapped dispatch function.
  function bindInject (dispatchFunc, defaults) {
    return original.bindInject(wrapDispatch(instrumentation, dispatchFunc), defaults)
  }

  Object.assign(inject, original, { default: inject, inject, bindInject, [kOriginal]: original })

  if (isFunctionExport) {
    return inject
  }

  moduleExports.default = inject
  moduleExports.inject = inject
  moduleExports.bindInject = bindInject
  return moduleExports
}

function unpatch (moduleExports) {
  const isFunctionExport = typeof moduleExports === 'function'
  const original = (isFunctionExport ? moduleExports : moduleExports.default)[kOriginal]

  if (!original) {
    return moduleExports
  }

  if (isFunctionExport) {
    return original
  }

  moduleExports.default = original
  moduleExports.inject = original
  moduleExports.bindInject = original.bindInject
  return moduleExports
}

/**
 * Creates SERVER spans for the requests dispatched through light-my-request.
 *
 * Injected requests never reach the Node.js HTTP server, so the HTTP instrumentation does not see them.
 * This covers `fastify.inject()` and the requests that undici-thread-interceptor delivers to a Watt application.
 */
export class LightMyRequestInstrumentation extends InstrumentationBase {
  constructor (config = {}) {
    super(packageJson.name, packageJson.version, config)
  }

  init () {
    return [
      new InstrumentationNodeModuleDefinition(
        'light-my-request',
        supportedVersions,
        moduleExports => patch(this, moduleExports),
        moduleExports => unpatch(moduleExports)
      )
    ]
  }
}

export default LightMyRequestInstrumentation

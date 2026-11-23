import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { InstrumentationBase, InstrumentationNodeModuleDefinition, isWrapped } from '@opentelemetry/instrumentation'
import fastUri from 'fast-uri'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf-8'))

const supportedVersions = ['>=2.0.0 <3']

// The symbol is registered globally so that the hooks are recognized across multiple copies of this package.
const kInstrumented = Symbol.for('platformatic.instrumentation.thread-interceptor.hook')

const headersSetter = {
  set (carrier, key, value) {
    carrier[key] = value
  }
}

// The standalone hooks have no instrumentation instance, so they are always enabled and use the global tracer.
const standaloneSource = {
  tracer: trace.getTracer(packageJson.name, packageJson.version),
  isEnabled () {
    return true
  }
}

function createHooks (instrumentation) {
  function onRequest (request, clientContext) {
    if (!instrumentation.isEnabled()) {
      return
    }

    const activeContext = context.active()
    const { origin, method = '', path } = request
    const targetUrl = `${origin}${path}`
    const url = fastUri.parse(targetUrl)
    const authority = url.port ? `${url.host}:${url.port}` : url.host

    const span = instrumentation.tracer.startSpan(
      `${method} ${url.scheme}://${authority}${url.path}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'server.address': url.host,
          'server.port': url.port,
          'http.request.method': method,
          'url.full': targetUrl,
          'url.path': url.path,
          'url.scheme': url.scheme
        }
      },
      activeContext
    )

    // The headers must be injected from the context holding the new span, otherwise the receiving
    // application would become a sibling of this span rather than its child.
    const headers = {}
    propagation.inject(trace.setSpan(activeContext, span), headers, headersSetter)
    request.headers = { ...request.headers, ...headers }

    clientContext.span = span
  }

  function onResponseEnd (_request, response, clientContext) {
    const span = clientContext.span
    if (!span) {
      return
    }

    if (!response) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'No response received' })
      span.end()
      return
    }

    span.setAttribute('http.response.status_code', response.statusCode)

    // These headers are set by the Watt HTTP cache when the response was served from it.
    const httpCacheId = response.headers?.['x-plt-http-cache-id']
    if (httpCacheId) {
      span.setAttributes({
        'http.cache.id': httpCacheId,
        'http.cache.hit': (response.headers.age !== undefined).toString()
      })
    }

    span.setStatus({ code: response.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK })
    span.end()
  }

  function onError (_request, _response, clientContext, error) {
    const span = clientContext.span
    if (!span) {
      return
    }

    span.setAttributes({
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack
    })
  }

  const hooks = { onRequest, onResponseEnd, onError }
  for (const hook of Object.values(hooks)) {
    hook[kInstrumented] = true
  }

  return hooks
}

function toArray (value) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function addHooks (instrumentation, options = {}) {
  const hooks = createHooks(instrumentation)

  // The caller already added the hooks explicitly, adding them again would duplicate every span.
  for (const name of Object.keys(hooks)) {
    if (toArray(options[name]).some(hook => hook[kInstrumented])) {
      return options
    }
  }

  const instrumented = { ...options }
  for (const [name, hook] of Object.entries(hooks)) {
    instrumented[name] = [...toArray(options[name]), hook]
  }

  return instrumented
}

/**
 * Returns the hooks to pass to `createInterceptor()` without registering the instrumentation, which is
 * useful when the caller owns the interceptor and does not want the module to be patched.
 */
export function createThreadInterceptorHooks () {
  return createHooks(standaloneSource)
}

/**
 * Creates CLIENT spans for the requests sent through undici-thread-interceptor and propagates the
 * trace context to the receiving thread.
 *
 * The receiving side is a light-my-request injection, which is covered by
 * `@platformatic/instrumentation-light-my-request`.
 */
export class ThreadInterceptorInstrumentation extends InstrumentationBase {
  constructor (config = {}) {
    super(packageJson.name, packageJson.version, config)
  }

  init () {
    return [
      new InstrumentationNodeModuleDefinition(
        'undici-thread-interceptor',
        supportedVersions,
        moduleExports => {
          if (isWrapped(moduleExports.createInterceptor)) {
            this._unwrap(moduleExports, 'createInterceptor')
          }

          this._wrap(moduleExports, 'createInterceptor', original => {
            const instrumentation = this

            return function (options) {
              return original.call(this, addHooks(instrumentation, options))
            }
          })

          return moduleExports
        },
        moduleExports => {
          if (isWrapped(moduleExports.createInterceptor)) {
            this._unwrap(moduleExports, 'createInterceptor')
          }

          return moduleExports
        }
      )
    ]
  }

  /**
   * Returns the hooks to pass to `createInterceptor()` when the module cannot be patched, for instance
   * because it was loaded before the instrumentation was registered.
   */
  createHooks () {
    return createHooks(this)
  }
}

export default ThreadInterceptorInstrumentation

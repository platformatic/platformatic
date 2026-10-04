'use strict'

const hyperid = require('hyperid')
const routing = require('./request-routing')
const { AsyncResource } = require('node:async_hooks')
const { threadId } = require('node:worker_threads')

const { DispatchController } = require('./dispatch-controller')
const { createInterceptor: createRoundRobinInterceptor } = require('./round-robin-interceptor')
const { MessagePortWritable, MessagePortReadable } = require('./message-port-streams')
const { WrapHandler } = require('./wrap-handler')
const {
  MESSAGE_REQUEST,
  kAddress,
  kClosed,
  kDomain,
  kHooks,
  kInflightOutgoing,
  kInflightStreams,
  kOnError,
  kRoutes,
  kTimeout
} = require('./utils')

/* c8 ignore next - Noop */
function noop () {}

// Handler wrapper that fires client hooks for network address dispatch path
class HookHandler {
  #handler
  #hooks
  #opts
  #ctx
  #statusCode

  constructor (handler, hooks, opts, ctx) {
    this.#handler = handler
    this.#hooks = hooks
    this.#opts = opts
    this.#ctx = ctx
  }

  onRequestStart (controller, context) {
    this.#handler.onRequestStart?.(controller, context)
  }

  onResponseStart (controller, statusCode, headers, statusMessage) {
    this.#statusCode = statusCode
    this.#hooks.fireOnClientResponse(this.#opts, { statusCode, headers }, this.#ctx)
    this.#handler.onResponseStart?.(controller, statusCode, headers, statusMessage)
  }

  onResponseData (controller, data) {
    this.#handler.onResponseData?.(controller, data)
  }

  onResponseEnd (controller, trailers) {
    this.#hooks.fireOnClientResponseEnd(this.#opts, { statusCode: this.#statusCode }, this.#ctx)
    this.#handler.onResponseEnd?.(controller, trailers)
  }

  onResponseError (controller, err) {
    this.#hooks.fireOnClientError(this.#opts, null, this.#ctx, err)
    this.#handler.onResponseError?.(controller, err)
  }
}

// Share prototype methods rather than allocating forwarding closures per request.
class TerminalHandler {
  constructor (handler) { this.handler = handler; this.terminal = false }
  onRequestStart (controller, context) { return this.handler.onRequestStart?.(controller, context) }
  onResponseStart (controller, statusCode, headers, statusMessage) {
    if (!this.terminal) return this.handler.onResponseStart?.(controller, statusCode, headers, statusMessage)
  }

  onResponseData (controller, data) { if (!this.terminal) return this.handler.onResponseData?.(controller, data) }
  onResponseEnd (controller, trailers) {
    if (!this.terminal) { this.terminal = true; return this.handler.onResponseEnd?.(controller, trailers) }
  }

  onResponseError (controller, error) {
    if (!this.terminal) { this.terminal = true; return this.handler.onResponseError?.(controller, error) }
  }
}

function createInterceptor (opts) {
  let { domain, timeout, meshTimeout, onError } = opts

  if (domain) {
    domain = domain.toLowerCase()
  }

  if (timeout === true) {
    timeout = 5000
  }

  if (meshTimeout === true || isNaN(meshTimeout) || meshTimeout < 0) {
    meshTimeout = 5000
  }

  const configuredApplications = new Set((opts.requestRoutingApplications ?? []).map(id => (id + domain).toLowerCase()))
  let requestRoutingEnabled = configuredApplications.size > 0
  const original = createRoundRobinInterceptor(opts)
  const routes = original[kRoutes]
  const hooks = original[kHooks]
  const nextId = hyperid()
  const streams = new Set()

  const interceptor = function threadInterceptor (dispatch) {
    const originalDispatcher = original(dispatch)
    return function dispatcher (opts, handler) {
      // The default hot path delegates before repeating URL/pool inspection.
      // Publishing a routed target enables selection for existing callers too.
      if (!requestRoutingEnabled && !interceptor[kClosed]) return originalDispatcher(opts, handler)
      let url = opts.origin
      if (!(url instanceof URL)) {
        url = new URL(opts.path, url)
      }

      const hostname = url.hostname.toLowerCase()

      // No hostname name, proceed with the next dispatcher
      if (domain === undefined || !hostname.endsWith(domain)) {
        return dispatch(opts, handler)
      }

      if (interceptor[kClosed]) throw new Error('The dispatcher has been closed.')
      const pool = routes.get(hostname)
      // Keep the upstream handler untouched for unconfigured applications.
      const hasState = pool?.ports.some(port => port[routing.kRouting])
      if (!hasState && !configuredApplications.has(hostname)) return originalDispatcher(opts, handler)
      // Hostnames are case-insensitive
      let selection
      try {
        if (!hasState) throw routing.overload(hostname)
        selection = routing.select(pool, hostname)
      } catch (error) {
        if (error.code !== 'PLT_REQUEST_CAPACITY_EXCEEDED') throw error
        // Surface admission as an HTTP response. Proxy adapters may replace
        // arbitrary dispatcher errors with 500, losing their statusCode.
        const rejectedHandler = handler.onRequestStart ? handler : new WrapHandler(handler)
        const controller = new DispatchController()
        const body = Buffer.from(JSON.stringify({ statusCode: 503, code: error.code, message: error.message }))
        rejectedHandler.onRequestStart(controller, {})
        if (controller.aborted) { rejectedHandler.onResponseError(controller, controller.reason); return true }
        rejectedHandler.onResponseStart(controller, 503, { 'content-type': 'application/json', 'content-length': String(body.length), 'x-platformatic-request-rejected': '1' }, 'Service Unavailable')
        rejectedHandler.onResponseData(controller, body)
        rejectedHandler.onResponseEnd(controller, [])
        return true
      }
      const { port, reservation } = selection
      if (!port) {
        throw new Error(`No target found for ${hostname} in thread ${threadId}.`)
      }

      let id, handle, requestBodyStream, responseBodyStream
      try {
      /* c8 ignore next - else */
        handler = handler.onRequestStart ? handler : new WrapHandler(handler)
        if (reservation) handler = new TerminalHandler(handler)

        if (port[kAddress]) {
          const headers = { ...opts?.headers, host: url.host }
          const newOpts = { ...opts, headers }
          const clientContext = { skipDiagnosticsChannel: true }
          hooks.fireOnClientRequest(newOpts, clientContext)

          const hookHandler = new HookHandler(handler, hooks, newOpts, clientContext)
          return dispatch({ ...newOpts, origin: port[kAddress] }, hookHandler)
        }

        id = nextId()
        const headers = { ...opts?.headers, host: url.host }
        const newOpts = { ...opts, headers }
        delete headers.connection
        delete headers['transfer-encoding']
        delete newOpts.dispatcher

        const controller = new DispatchController()
        if (reservation) {
          handler.onRequestStart(controller, {})
          if (controller.aborted) throw controller.reason || new Error('Request aborted')
        }

        // We use it as client context where hooks can add non-serializable properties
        const clientContext = {}
        hooks.fireOnClientRequest(newOpts, clientContext)

        const requestMessage = { type: MESSAGE_REQUEST, id, opts: newOpts, threadId }
        if (reservation) requestMessage.reservation = routing.serialized(reservation)
        let transferList = []

        // Send the body as a transferable if it is a stream or an async iterable
        if (typeof newOpts.body?.resume === 'function' || newOpts.body?.[Symbol.asyncIterator]) {
          const transferable = MessagePortWritable.asTransferable({ body: newOpts.body })
          delete newOpts.body

          requestBodyStream = transferable.stream
          requestMessage.port = transferable.port
          transferList = transferable.transferList
        }

        if (typeof timeout === 'number') {
          handle = setTimeout(function () {
            const error = new Error(`Timeout while waiting from a response from ${url.hostname}`)
            if (reservation) controller.abort(error)
            else { port[kInflightOutgoing].delete(id); handler.onResponseError(controller, error) }
          }, timeout)
        }

        port[kInflightOutgoing].set(
          id,
          AsyncResource.bind(function handleInflightResponse (error, res) {
            clearTimeout(handle)

            if (error) {
              hooks.fireOnClientError(newOpts, res, clientContext, error)
              handler.onResponseError(controller, error)
              return
            }
            try {
              hooks.fireOnClientResponse(newOpts, res, clientContext)
              if (!reservation) handler.onRequestStart(controller, {})
              if (controller.aborted) {
                res.port?.close()
                handler.onResponseError(controller, controller.reason)
                return
              }

              handler.onResponseStart(controller, res.statusCode, res.headers, res.statusMessage)
              // TODO(mcollina): I don't think this can be triggered,
              // but we should consider adding a test for this in the future
              /* c8 ignore next 6 */
              if (controller.aborted) {
                res.port?.close()
                handler.onResponseError(controller, controller.reason)
                return
              }
            /* c8 ignore next 6 */
            } catch (error) {
              res.port?.close()
              handler.onResponseError(controller, error)
              return
            }

            if (res.port) {
              const body = responseBodyStream = new MessagePortReadable({
                port: res.port
              })

              const cancel = () => controller.abort(new Error('The dispatcher has been closed.'))
              if (reservation) {
                streams.add(cancel)
                body.once('close', () => streams.delete(cancel))
              }

              controller.on('resume', function () {
                body.resume()
              })

              controller.on('pause', function () {
                body.pause()
              })

              body.on('data', function (chunk) {
                try {
                  handler.onResponseData(controller, chunk)
                /* c8 ignore next 4 */
                } catch (error) {
                  res.port.close()
                  handler.onResponseError(controller, error)
                }
              })

              body.on('end', function () {
                try {
                  handler.onResponseEnd(controller, [])
                /* c8 ignore next 4 */
                } catch (error) {
                  res.port.close()
                  handler.onResponseError(controller, error)
                }

                hooks.fireOnClientResponseEnd(newOpts, res, clientContext)
              })

              body.on('error', function (error) {
                handler.onResponseError(controller, error)
              })
            } else {
              try {
                handler.onResponseData(controller, res.body)
                handler.onResponseEnd(controller, [])
              } catch (error) {
                handler.onResponseError(controller, error)
              }

              hooks.fireOnClientResponseEnd(newOpts, res, clientContext)
            }
          })
        )

        if (reservation) {
          controller.once('abort', reason => {
            if (handler.terminal) return
            responseBodyStream?.destroy(reason)
            clearTimeout(handle)
            port[kInflightOutgoing].delete(id)
            requestBodyStream?.destroy(reason)
            hooks.fireOnClientError(newOpts, null, clientContext, reason)
            handler.onResponseError(controller, reason)
          })
        }
        port.postMessage(requestMessage, transferList)
        return true
      } catch (error) {
        clearTimeout(handle)
        if (id) port[kInflightOutgoing].delete(id)
        requestBodyStream?.destroy(error)
        routing.release(reservation)
        throw error
      }
    }
  }

  interceptor.registerRequestRouting = hostname => { configuredApplications.add(hostname); requestRoutingEnabled = true }
  interceptor[kInflightStreams] = streams
  interceptor.cancelStreams = () => { for (const cancel of streams) cancel() }
  interceptor[kDomain] = domain
  interceptor[kRoutes] = routes
  interceptor[kHooks] = hooks
  interceptor[kTimeout] = meshTimeout
  interceptor[kOnError] = onError ?? noop

  return interceptor
}

module.exports = { createInterceptor }

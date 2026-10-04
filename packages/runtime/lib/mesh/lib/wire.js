'use strict'

const inject = require('light-my-request')
const routing = require('./request-routing')
const { threadId } = require('node:worker_threads')
const { getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const diagnosticsChannel = require('node:diagnostics_channel')
const timers = require('node:timers/promises')
const { performance } = require('node:perf_hooks')
const fastq = require('fastq')

const { addRoute: commonAddRoute, updateRoute, removeRoute } = require('./common')
const { MessagePortWritable, MessagePortReadable } = require('./message-port-streams')
const {
  debug,
  kHasInject,
  kClosed,
  kSourceClosed,
  kHooks,
  kInflightIncoming,
  kInflightOutgoing,
  kReady,
  kAddress,
  kRoutes,
  kServer,
  kOnError,
  kThread,
  kQueue,
  MAX_BODY,
  MAX_QUEUE,
  MESSAGE_WIRE,
  MESSAGE_CLOSE,
  MESSAGE_REQUEST,
  MESSAGE_RESPONSE,
  MESSAGE_ROUTE_ADD,
  MESSAGE_ROUTE_REMOVE,
  MESSAGE_ROUTE_UPDATE,
  MESSAGE_ROUTE_ADDED,
  MESSAGE_ROUTE_REMOVED,
  MESSAGE_ROUTE_UPDATED,
  waitMessage,
  ThreadInterceptorError,
  kTimeout
} = require('./utils')

const CHANNEL_NAME_REQUEST_START = 'http.server.request.start'
const CHANNEL_NAME_RESPONSE_FINISH = 'http.server.response.finish'
const channelStart = diagnosticsChannel.channel(CHANNEL_NAME_REQUEST_START)
const channelFinish = diagnosticsChannel.channel(CHANNEL_NAME_RESPONSE_FINISH)

const { uvMetricsInfo } = performance.nodeTiming

async function collectBody (stream) {
  const data = []

  for await (const chunk of stream) {
    data.push(chunk)
  }

  /* c8 ignore next 7 */
  if (data[0] instanceof Buffer || data[0] instanceof Uint8Array || data.length === 0) {
    return Buffer.concat(data)
  } else {
    throw new Error('Cannot transfer streams of strings or objects')
  }
}

async function onInject (interceptor, port, id, resolve, injectOpts, error, res) {
  if (port[kSourceClosed]) { res?.stream().destroy(); resolve(); return }
  if (error) {
    // Do not emit a channelFinish here because it's not part of Node.js
    // behavior.
    interceptor[kHooks].fireOnServerError(injectOpts, res, error)
    port.postMessage({ type: MESSAGE_RESPONSE, id, error })

    resolve()
    return
  }

  const length = res.headers['content-length']
  const parsedLength = length === undefined ? MAX_BODY : Number(length)

  let responseMessage = {
    type: MESSAGE_RESPONSE,
    id,
    res: { headers: res.headers, statusCode: res.statusCode }
  }
  let transferList = []
  let streaming = false

  try {
    if (parsedLength < MAX_BODY) {
      responseMessage.res.body = await collectBody(res.stream())
    } else {
      const source = res.stream()
      source.once('end', resolve)
      source.once('close', resolve)
      source.once('error', resolve)
      const transferable = MessagePortWritable.asTransferable({ body: source })
      streaming = true
      responseMessage.res.port = transferable.port
      transferList = transferable.transferList
    }
  } catch (error) {
    responseMessage = { type: MESSAGE_RESPONSE, id, error }
  }

  channelFinish.publish({
    request: injectOpts,
    response: res,
    server: interceptor[kServer]
  })

  interceptor[kHooks].fireOnServerResponse(injectOpts, responseMessage)
  port.postMessage(responseMessage, transferList)
  if (!streaming || !resolve.requestRouting) resolve()
}

function onWireMessage (interceptor, port, urlOrMessage, message = urlOrMessage) {
  debug('onWireMessage', message)

  switch (message.type) {
    case MESSAGE_WIRE:
      port.postMessage({
        type: MESSAGE_WIRE,
        ready: interceptor[kReady],
        address: interceptor[kAddress],
        requestRouting: interceptor[routing.kLocalRouting]
      })
      break
    case MESSAGE_REQUEST:
      if (message.reservation && !routing.accept(message.reservation, interceptor[routing.kLocalRouting])) {
        message.port?.close()
        port.postMessage({ type: MESSAGE_RESPONSE, id: message.id, error: new Error('Expired request reservation') })
        break
      }
      interceptor[kQueue].push({ port, message })
      break
    case MESSAGE_RESPONSE:
      // eslint-disable-next-line no-case-declarations
      const inflight = port[kInflightOutgoing].get(message.id)

      if (inflight) {
        const { id, res, error } = message

        port[kInflightOutgoing].delete(id)
        inflight(error, res)
      } else {
        message.res?.port?.close()
      }

      break
    case MESSAGE_ROUTE_ADD:
      message.port[kThread] = message.threadId
      message.port[kReady] = message.ready
      message.port[kAddress] = message.address
      message.port[routing.kRouting] = message.requestRouting
      message.port.once('close', () => routing.reclaimSender(interceptor[routing.kLocalRouting], message.threadId + 1))

      interceptor.route(message.url, message.port)
      port.postMessage({ type: MESSAGE_ROUTE_ADDED, threadId: message.threadId })
      break
    case MESSAGE_ROUTE_REMOVE:
      removeRoute(interceptor, message.threadId)
        .then(() => port.postMessage({ type: MESSAGE_ROUTE_REMOVED, threadId: message.threadId }))
        /* c8 ignore next 11 - Hard to test */
        .catch(error => {
          process.nextTick(() => {
            interceptor[kOnError](
              new ThreadInterceptorError('Failed to remove a route in a thread.', {
                cause: error,
                port,
                thread: port[kThread],
                meshMessage: message
              })
            )
          })
        })
      break
    case MESSAGE_ROUTE_UPDATE:
      updateRoute(interceptor, message.url, message.threadId, message.ready, message.address, message.requestRouting)
      port.postMessage({ type: MESSAGE_ROUTE_UPDATED, threadId: message.threadId })
      break
    case MESSAGE_CLOSE:
      interceptor.close()
      break
  }
}

function onRequest (interceptor, { port, message }) {
  const { id, opts, port: bodyPort, reservation } = message
  let bodyReadable

  if (bodyPort) {
    bodyReadable = new MessagePortReadable({
      port: bodyPort
    })
  }

  const headers = {}
  const { promise, resolve: resolvePromise } = Promise.withResolvers()
  const resolve = reservation ? () => { routing.release(reservation); resolvePromise() } : resolvePromise
  if (reservation) resolve.requestRouting = true

  // Autoclean from the list
  promise.finally(() => {
    interceptor[kInflightIncoming].delete(id)
  })

  interceptor[kInflightIncoming].set(id, promise)

  for (const [key, value] of Object.entries(opts.headers)) {
    if (value !== undefined && value !== null) {
      headers[key] = value
    }
  }

  const injectOpts = {
    method: opts.method,
    url: opts.path,
    headers,
    query: opts.query,
    body: opts.body || bodyReadable,
    payloadAsStream: true
  }

  channelStart.publish({
    request: injectOpts,
    server: interceptor[kServer]
  })

  try {
    interceptor[kHooks].fireOnServerRequest(injectOpts, function () {
    // This is still possible in case if someone calls replaceServer
    // with a null server under high load.
    /* c8 ignore next 10 */
      if (!interceptor[kServer]) {
        port.postMessage({
          type: MESSAGE_RESPONSE,
          id,
          error: new Error(`No responding server found for ${injectOpts.headers.host} in thread ${threadId}.`)
        })

        resolve()
        return
      }

      const boundOnInject = onInject.bind(null, interceptor, port, id, resolve, injectOpts)

      if (!Buffer.isBuffer(injectOpts.body) && injectOpts.body instanceof Uint8Array) {
        injectOpts.body = Buffer.from(injectOpts.body)
      }

      if (interceptor[kHasInject]) {
        interceptor[kServer].inject(injectOpts, boundOnInject)
      } else {
        inject(interceptor[kServer], injectOpts, boundOnInject)
      }
    })
  } catch (error) {
    resolve()
    port.postMessage({ type: MESSAGE_RESPONSE, id, error })
  }
}

function addRoute (interceptor, url, ports) {
  if (!Array.isArray(ports)) {
    ports = [ports]
  }

  for (const port of ports) {
    commonAddRoute(interceptor, url, port, onWireMessage)
  }
}

async function close (interceptor, port) {
  interceptor[kClosed] = true
  interceptor.cancelStreams()
  routing.beginDrain(interceptor[routing.kLocalRouting])
  // Wait for the root thread to acknowledge the propagation.
  // This is needed to make sure all inflight requests are recorded.
  const removedPromise = waitMessage(
    port,
    { timeout: interceptor[kTimeout], description: 'MESSAGE_ROUTE_REMOVED' },
    function (message) {
      return message.type === MESSAGE_ROUTE_REMOVED
    }
  )

  // Notify the root, it will take care of propagating the message
  port.postMessage({ type: MESSAGE_ROUTE_REMOVE, threadId })

  await removedPromise

  // Wait for queue to fully drain. Messages that were in-transit may arrive
  // after MESSAGE_ROUTE_REMOVED, so we keep draining until the queue is empty.
  /* c8 ignore next 5 */
  const queue = interceptor[kQueue]
  while (queue.length() > 0) {
    await queue.drained()
  }

  // Paolo: This is impossible to test, as it is almost impossible to produce
  // out of order dispatch of messages sharded between different MessagePorts.
  // We have observed this behavior to happen under high load and therefore
  // we are introducing the while loop as an additional safety measure.
  /* c8 ignore next 4 */
  while (interceptor[kInflightIncoming].size > 0) {
    // Wait for all inflight requests to finish
    await Promise.all(Array.from(interceptor[kInflightIncoming].values()))
  }

  // Notify the parent we have exited
  port.postMessage({ type: MESSAGE_CLOSE })

  // Close all the ports
  for (const [, roundRobin] of interceptor[kRoutes]) {
    for (const otherPort of roundRobin) {
      otherPort.close()
    }
  }
}

function replaceServer (interceptor, port, server) {
  if (server && interceptor[kClosed] && interceptor[routing.kLocalRouting]) throw new Error('The dispatcher has been closed.')
  if (typeof server === 'string' && interceptor[routing.kLocalRouting]) throw new Error('Request routing requires an in-process mesh server')
  interceptor[kServer] = server

  let address = null
  if (typeof server === 'string') {
    interceptor[kHasInject] = false
    address = server
  } else {
    const hasInject = typeof server?.inject === 'function'
    interceptor[kHasInject] = hasInject
  }

  const ready = !!server
  routing.setReady(interceptor[routing.kLocalRouting], ready)

  if (interceptor[kReady] !== ready || interceptor[kAddress] !== null) {
    interceptor[kReady] = ready
    interceptor[kAddress] = address
    port.postMessage({ type: MESSAGE_WIRE, ready, address, requestRouting: interceptor[routing.kLocalRouting] })
  }
}

function createWire (interceptor, newServer, port, options = {}) {
  interceptor[routing.kLocalRouting] = options.requestRouting
  setGlobalDispatcher(getGlobalDispatcher().compose(interceptor))

  let lastLoop = 0
  let pipelining = 0

  // This queue is used to ensure we yield the event loop between requests
  // It's triggered only when we detect that we are on the same loop iteration,
  // and it guarantees tht we process at most MAX_QUEUE requests per macrotick
  // preventing event loop starvation.
  // This simulates what libuv does with its internal event queue
  // for network events.
  interceptor[kQueue] = fastq.promise(async function (msg) {
    onRequest(interceptor, msg)

    const currentLoop = uvMetricsInfo.loopCount

    if (currentLoop === lastLoop) {
      pipelining++
    } else {
      lastLoop = currentLoop
      pipelining = 0
    }

    if (pipelining >= MAX_QUEUE) {
      await timers.setImmediate()
    }
  }, MAX_QUEUE)
  interceptor[kHasInject] = false
  interceptor[kServer] = undefined
  interceptor[kReady] = false
  interceptor[kAddress] = null
  interceptor[kInflightIncoming] = new Map()

  replaceServer(interceptor, port, newServer)
  interceptor.route = addRoute.bind(null, interceptor)
  interceptor.close = close.bind(null, interceptor, port)

  port.on('message', onWireMessage.bind(null, interceptor, port))

  return {
    interceptor,
    replaceServer: function (server) {
      if (server === undefined) {
        throw new Error('server argument is required')
      }
      return replaceServer(interceptor, port, server)
    },
    close: close.bind(null, interceptor, port)
  }
}

module.exports = { createWire }

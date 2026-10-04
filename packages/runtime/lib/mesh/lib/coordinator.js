'use strict'

const { MessageChannel } = require('node:worker_threads')
const routing = require('./request-routing')

const {
  addRoute: commonAddRoute,
  normalizeUrl,
  removeRoute: commonRemoveRoute,
  updateRoute: commonUpdateRoute
} = require('./common')
const {
  debug,
  kAddress,
  kClosed,
  kDomain,
  kHooks,
  kInflightOutgoing,
  kLoopback,
  kOnError,
  kOnReadyHook,
  kReady,
  kRoutes,
  kThread,
  kTimeout,
  kWired,
  MESSAGE_CLOSE,
  MESSAGE_RESPONSE,
  MESSAGE_ROUTE_ADD,
  MESSAGE_ROUTE_ADDED,
  MESSAGE_ROUTE_REMOVE,
  MESSAGE_ROUTE_REMOVED,
  MESSAGE_ROUTE_UPDATE,
  MESSAGE_ROUTE_UPDATED,
  MESSAGE_WIRE,
  ThreadInterceptorError,
  waitMessage
} = require('./utils')

function onCoordinatorMessage (interceptor, port, url, message) {
  debug('onCoordinatorMessage', message)

  switch (message.type) {
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
    case MESSAGE_WIRE:
      wire(interceptor, port, url, message.ready, message.address, message.requestRouting)
        .catch(error => {
          process.nextTick(() => {
            interceptor[kOnError](
              new ThreadInterceptorError('Failed to wire a new thread.', {
                cause: error,
                port,
                thread: port[kThread],
                url,
                meshMessage: message
              })
            )
          })
        })
        // The wire method above can only throw if timing out while waiting for other threads to respond.
        // Even if the other threads have the mesh network broken, we consider this thread ready.
        .finally(() => {
          if (message.ready) {
            port[kOnReadyHook]?.()
            port[kOnReadyHook] = null
          }
        })

      break
    case MESSAGE_ROUTE_REMOVE:
      removeThreadRoutes(interceptor, message.threadId)
        .then(() => port.postMessage({ type: MESSAGE_ROUTE_REMOVED }))
        /* c8 ignore next 12 - Hard to test */
        .catch(error => {
          process.nextTick(() => {
            interceptor[kOnError](
              new ThreadInterceptorError('Failed to remove route in coordinator.', {
                cause: error,
                port,
                thread: port[kThread],
                url,
                meshMessage: message
              })
            )
          })
        })
      break
  }
}

async function addRoute (interceptor, url, ports) {
  if (interceptor[kClosed]) {
    throw new Error('The dispatcher has been closed.')
  }

  if (!Array.isArray(ports)) {
    ports = [ports]
  }

  const promises = []

  for (const port of ports) {
    const added = commonAddRoute(interceptor, url, port, onCoordinatorMessage)
    if (!added) continue

    port.once('exit', () => routing.retire(port[routing.kRouting]))
    port[kWired] = false
    port[kReady] = false
    port[kAddress] = null
    port.postMessage({ type: MESSAGE_WIRE })

    const promise = new Promise(resolve => {
      port[kOnReadyHook] = resolve
    })
    promises.push(promise)
  }

  await Promise.all(promises)
}

async function wire (interceptor, port, url, ready, address, requestRouting) {
  /* c8 ignore next 1 */
  if (interceptor[kClosed]) return

  if (port[kWired] === true && port[kReady] === ready && port[kAddress] === address && !requestRouting) {
    return
  }

  const routes = interceptor[kRoutes]
  const threadId = port[kThread]

  // Check if route was not removed
  // while was waiting to wire the port
  const isExists = routes.get(url)?.ports?.includes(port)
  if (!isExists) return

  const wired = port[kWired]
  port[kWired] = true

  commonUpdateRoute(interceptor, url, threadId, ready, address, requestRouting)

  const promises = []

  for (const [key, roundRobin] of routes) {
    const url1 = key.replace(interceptor[kDomain], '').toLowerCase()
    const url2 = url.replace(interceptor[kDomain], '').toLowerCase()

    if (url1 === url2) {
      // Wire a loopback MessageChannel so a thread can reach its own
      // hostname (i.e. a service calling itself). Both channel ends are
      // registered in the same thread: a request dispatched out of one end
      // is served by the wire handler listening on the other end.
      // The messages are intentionally not awaited: the thread can only
      // dispatch to itself once it has processed them, and MessagePort
      // buffers messages until a listener is attached, so no request can
      // be lost. Awaiting here would also delay the ready hook and let a
      // pending wire() resolve a later route() registration prematurely.
      if (!roundRobin.has(port)) continue

      // Create the loopback only once per (port, hostname): re-wiring the
      // same port (e.g. when it is registered under an additional hostname)
      // must not add duplicate loopback channels. An existing loopback only
      // needs its ready state refreshed.
      port[kLoopback] ??= new Set()
      if (wired || port[kLoopback].has(key)) {
        port.postMessage({
          type: MESSAGE_ROUTE_UPDATE,
          url,
          ready: port[kReady],
          threadId: port[kThread],
          address: port[kAddress],
          requestRouting: port[routing.kRouting]
        })
        continue
      }
      port[kLoopback].add(key)

      const { port1, port2 } = new MessageChannel()
      for (const loopbackPort of [port1, port2]) {
        port.postMessage(
          {
            type: MESSAGE_ROUTE_ADD,
            url: url2,
            port: loopbackPort,
            ready: port[kReady],
            address: port[kAddress],
            requestRouting: port[routing.kRouting],
            threadId: port[kThread]
          },
          [loopbackPort]
        )
      }
      continue
    }

    const isAllowed = interceptor[kHooks].fireOnChannelCreation(url1, url2)
    if (isAllowed === false) continue

    for (const other of roundRobin) {
      if (other === port || !other[kWired]) {
        continue
      }

      if (wired) {
        promises.push(
          waitMessage(
            other,
            { timeout: interceptor[kTimeout], description: 'MESSAGE_ROUTE_UPDATED' },
            m => m.type === MESSAGE_ROUTE_UPDATED && m.threadId === port[kThread]
          )
        )
        other.postMessage({
          type: MESSAGE_ROUTE_UPDATE,
          url,
          ready: port[kReady],
          threadId: port[kThread],
          address: port[kAddress],
          requestRouting: port[routing.kRouting]
        })
        continue
      }

      const { port1, port2 } = new MessageChannel()
      promises.push(
        waitMessage(
          port,
          { timeout: interceptor[kTimeout], description: 'MESSAGE_ROUTE_ADDED' },
          m => m.type === MESSAGE_ROUTE_ADDED && m.threadId === other[kThread]
        )
      )

      promises.push(
        waitMessage(
          other,
          { timeout: interceptor[kTimeout], description: 'MESSAGE_ROUTE_ADDED' },
          m => m.type === MESSAGE_ROUTE_ADDED && m.threadId === port[kThread]
        )
      )

      port.postMessage(
        {
          type: MESSAGE_ROUTE_ADD,
          url: url1,
          port: port1,
          ready: other[kReady],
          address: other[kAddress],
          requestRouting: other[routing.kRouting],
          threadId: other[kThread]
        },
        [port1]
      )
      other.postMessage(
        {
          type: MESSAGE_ROUTE_ADD,
          url: url2,
          port: port2,
          ready: port[kReady],
          address: port[kAddress],
          requestRouting: port[routing.kRouting],
          threadId: port[kThread]
        },
        [port2]
      )
    }
  }

  const results = await Promise.allSettled(promises)

  for (const result of results) {
    if (result.status === 'rejected') {
      debug('mesh wire timeout (non-fatal):', result.reason?.message)
    }
  }
}

async function removeRoute (interceptor, url, ports, force = false) {
  url = normalizeUrl(interceptor, url)

  if (interceptor[kClosed] && !force) {
    throw new Error('The dispatcher has been closed.')
  }

  if (!Array.isArray(ports)) {
    ports = [ports]
  }

  const routes = interceptor[kRoutes]
  const roundRobin = routes.get(url)
  if (!roundRobin) return

  const threadIds = []
  for (const port of ports) {
    if (roundRobin.ports?.includes(port)) {
      threadIds.push(port[kThread])
    }
  }

  const promises = []
  for (const threadId of threadIds) {
    promises.push(removeThreadRoutes(interceptor, threadId))
  }
  await Promise.all(promises)
}

async function removeThreadRoutes (interceptor, threadId) {
  const routes = interceptor[kRoutes]
  const otherPorts = new Set()

  for (const roundRobin of routes.values()) {
    for (const port of roundRobin) {
      if (port[kThread] === threadId) {
        port[kOnReadyHook]?.()
        port[kOnReadyHook] = null
        continue
      }
      if (port[kWired]) {
        otherPorts.add(port)
      }
    }
  }

  const promises = [commonRemoveRoute(interceptor, threadId)]

  // Notify all ports in the roundRobin that the route has been removed
  for (const otherPort of otherPorts) {
    promises.push(
      waitMessage(
        otherPort,
        { timeout: interceptor[kTimeout], description: 'MESSAGE_ROUTE_REMOVED' },
        m => m.type === MESSAGE_ROUTE_REMOVED && m.threadId === threadId
      )
    )
    otherPort.postMessage({ type: MESSAGE_ROUTE_REMOVE, threadId })
  }

  await Promise.all(promises)
}

async function close (interceptor) {
  interceptor[kClosed] = true

  const routes = interceptor[kRoutes]
  const ports = []

  // Important: do not call the messages inside the loop as if the collection is mutated some entries might be skipped
  for (const [url, roundRobin] of routes) {
    for (const port of roundRobin) {
      ports.push([url, port])
    }
  }

  for (const [url, port] of ports) {
    /* c8 ignore next 4 - This is hard to test but under high load it might happen */
    // If the port has been removed in the meanwhile, skip it
    if (!routes.get(url)?.ports?.includes(port)) {
      continue
    }

    const closedPromise = waitMessage(
      port,
      { timeout: interceptor[kTimeout], description: 'MESSAGE_CLOSE' },
      message => message.type === MESSAGE_CLOSE
    )

    port.postMessage({ type: MESSAGE_CLOSE })

    await closedPromise
  }
}

function restart (interceptor) {
  interceptor[kClosed] = false
}

function createCoordinator (interceptor) {
  interceptor.close = close.bind(null, interceptor)
  interceptor.restart = restart.bind(null, interceptor)

  // New interface
  interceptor.addRoute = addRoute.bind(null, interceptor)
  interceptor.removeRoute = removeRoute.bind(null, interceptor)

  // Old interface, should be deprecated at some point
  interceptor.route = addRoute.bind(null, interceptor)
  interceptor.unroute = removeRoute.bind(null, interceptor)

  return interceptor
}

module.exports = { createCoordinator, addRoute }

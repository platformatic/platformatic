'use strict'

const routing = require('./request-routing')
const { RoundRobin } = require('./roundrobin')
const { RequestsStore } = require('./requests-store')
const { kAddress, kSourceClosed, kReady, kDomain, kInflightOutgoing, kRoutes, kThread } = require('./utils')

function normalizeUrl (interceptor, url) {
  const domain = interceptor[kDomain]

  if (domain && !url.endsWith(domain)) {
    url += domain
  }

  // Hostname are case-insensitive
  return url.toLowerCase()
}

function onClose (interceptor, port, url) {
  port[kSourceClosed] = true
  const routes = interceptor[kRoutes]

  const roundRobin = routes.get(url)

  if (roundRobin) {
    roundRobin.delete(port)

    if (roundRobin.length === 0) {
      routes.delete(url)
    }
  }

  // Settle route-drain waiters as well as client callbacks. The backend owns
  // accepted reservations; losing this channel never releases that work.
  const requests = port[kInflightOutgoing]
  const callbacks = [...requests.values()]
  for (const id of requests.keys()) requests.delete(id)
  for (const cb of callbacks) {
    cb(new Error('The target worker thread has exited before sending a response.'))
  }

  // Notify other threads that any eventual network address for this route is no longer valid
  updateRoute(interceptor, url, port[kThread], false, null)
}

function addRoute (interceptor, url, port, onMessage) {
  const routes = interceptor[kRoutes]

  // We must copy the threadId outsise because it can be nulled by Node.js
  if (typeof port[kThread] === 'undefined') {
    port[kThread] = port.threadId
  }

  port[kInflightOutgoing] = new RequestsStore()
  url = normalizeUrl(interceptor, url)

  if (!routes.has(url)) {
    routes.set(url, new RoundRobin())
  }

  const roundRobin = routes.get(url)
  if (port[routing.kRouting]) interceptor.registerRequestRouting(url)
  // Already in the round-robin, do nothing
  if (roundRobin.has(port)) {
    return false
  }

  roundRobin.add(port)

  port.once('close', () => { port[kSourceClosed] = true })
  const boundClose = onClose.bind(null, interceptor, port, url)
  port.on('message', onMessage.bind(null, interceptor, port, url))
  port.on('exit', boundClose)
  port.on('close', boundClose)

  return true
}

async function removeRoute (interceptor, thread) {
  const routes = interceptor[kRoutes]
  const removedPorts = []

  // Remove all routes for the thread
  for (const [url, roundRobin] of routes) {
    const port = roundRobin.findByThreadId(thread)
    if (!port) continue

    roundRobin.delete(port)
    removedPorts.push(port)

    if (roundRobin.length === 0) {
      routes.delete(url)
    }
  }

  const drainedPromises = []

  for (const port of removedPorts) {
    const inflightReqs = port[kInflightOutgoing]
    if (inflightReqs.size > 0) {
      const drainedPromise = port[kInflightOutgoing].drained()
      drainedPromises.push(drainedPromise)
    }
  }

  await Promise.all(drainedPromises)
}

function updateRoute (interceptor, url, threadId, ready, address, requestRouting) {
  const port = interceptor[kRoutes].get(url)?.findByThreadId(threadId)
  if (port) {
    port[kReady] = ready
    if (requestRouting) {
      port[routing.kRouting] = requestRouting
      interceptor.registerRequestRouting(normalizeUrl(interceptor, url))
    }

    if (address) {
      port[kAddress] = address
    }
  }
}

module.exports = { normalizeUrl, addRoute, onClose, removeRoute, updateRoute }

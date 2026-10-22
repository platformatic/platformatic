import { getEvents, isEntrypoint } from '@platformatic/globals'
import { subscribe, tracingChannel, unsubscribe } from 'node:diagnostics_channel'
import { Server as HttpServer } from 'node:http'
import { Server as HttpsServer } from 'node:https'
import { Server as NetServer } from 'node:net'

// Some frameworks (Vite 8 and later) look for a free port by opening and immediately closing
// throwaway TCP servers before binding the real one. Those probes are bare net.Server instances,
// while any application server is an http, https or http2 server, so they can be told apart by
// their constructor. Probes must never be mistaken for the application server: they are already
// closed by the time the capability reads their address, and the errors they raise are recovered
// from by the framework itself.
function isPortProbe (server) {
  return server?.constructor === NetServer
}

// Other frameworks (the Nuxt CLI 4 and later) check whether the platform supports SO_REUSEPORT by
// binding throwaway HTTP servers before the real one. Unlike the probes above those are HTTP servers,
// but they are created without any handler as they are never meant to serve anything.
export const applicationServerEvents = ['request', 'upgrade', 'connect', 'checkContinue', 'checkExpectation']

export function isBareHttpServer (server) {
  if (!(server instanceof HttpServer) && !(server instanceof HttpsServer)) {
    return false
  }

  return applicationServerEvents.every(event => server.listenerCount(event) === 0)
}

export function createServerListener (overridePort = true, overrideHost = false, additionalOptions = {}) {
  const { promise, resolve, reject } = Promise.withResolvers()

  let completed = false
  const subscribers = {
    asyncStart ({ options }) {
      // Unix socket, do nothing
      if (options.path) {
        return
      }

      if (typeof overridePort !== 'number' && overridePort !== false) {
        overridePort = 0
      }

      if (typeof overrideHost === 'string') {
        options.host = overrideHost
      }

      // Check if we need to override the port only if a static port is being requested
      if (overridePort !== false && overridePort !== 0) {
        // The user application has requested a specific port, which is not the entrypoint one. Override it.
        if (options.port !== overridePort && isEntrypoint({ throwOnMissing: false })) {
          options.port = overridePort
        }
      }

      Object.assign(options, additionalOptions)
      const events = getEvents({ throwOnMissing: false })
      if (events) {
        events.emitAndNotify('serverOptions', options)
      }
    },
    asyncEnd ({ server }) {
      // Keep listening: the server options above must still be applied to the real server.
      if (isPortProbe(server)) {
        return
      }

      cancel()
      resolve(server)
    },
    error ({ error, server }) {
      // The framework retries on a different port after a failed probe, so this is not fatal.
      if (isPortProbe(server)) {
        return
      }

      cancel()
      reject(error)
    }
  }

  function cancel () {
    completed = true
    tracingChannel('net.server.listen').unsubscribe(subscribers)
  }

  tracingChannel('net.server.listen').subscribe(subscribers)
  promise.cancel = function () {
    if (completed) {
      return
    }

    cancel()
    resolve(null)
  }

  return promise
}

export function createChildProcessListener () {
  const { promise, resolve } = Promise.withResolvers()

  const handler = ({ process: child }) => {
    unsubscribe('child_process', handler)
    resolve(child)
  }

  function cancel () {
    unsubscribe('child_process', handler)
  }

  subscribe('child_process', handler)

  promise.finally(cancel)
  promise.cancel = resolve.bind(null, null)

  return promise
}

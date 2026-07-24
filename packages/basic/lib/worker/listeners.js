import { getEvents } from '@platformatic/globals'
import { subscribe, tracingChannel, unsubscribe } from 'node:diagnostics_channel'

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
        if (options.port !== overridePort) {
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
      cancel()
      resolve(server)
    },
    error ({ error }) {
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

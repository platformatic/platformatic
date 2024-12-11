import { features, withResolvers } from '@platformatic/utils'
import { subscribe, tracingChannel, unsubscribe } from 'node:diagnostics_channel'

export function createServerListener (overridePort = true, overrideHost) {
  const { promise, resolve, reject } = withResolvers()

  const subscribers = {
    asyncStart ({ options }) {
      // Unix socket, do nothing
      if (options.path) {
        return
      }

      if (overridePort !== false) {
        const hasFixedPort = typeof overridePort === 'number'
        options.port = hasFixedPort ? overridePort : 0

        if (hasFixedPort && features.node.reusePort) {
          options.reusePort = true
        }
      }

      if (typeof overrideHost === 'string') {
        options.host = overrideHost
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
    tracingChannel('net.server.listen').unsubscribe(subscribers)
  }

  tracingChannel('net.server.listen').subscribe(subscribers)
  promise.cancel = function () {
    cancel()
    resolve(null)
  }

  return promise
}

export function createChildProcessListener () {
  const { promise, resolve } = withResolvers()

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

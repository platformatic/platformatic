import { withResolvers } from '@platformatic/utils'
import { subscribe, tracingChannel, unsubscribe } from 'node:diagnostics_channel'

export function createServerListener (overridePort = true) {
  const { promise, resolve, reject } = withResolvers()

  const subscribers = {
    asyncStart ({ options }) {
      if (overridePort !== false) {
        options.port = typeof overridePort === 'number' ? overridePort : 0
      }
    },
    asyncEnd ({ server }) {
      resolve(server)
    },
    error (error) {
      cancel()
      reject(error)
    }
  }

  function cancel () {
    tracingChannel('net.server.listen').unsubscribe(subscribers)
  }

  tracingChannel('net.server.listen').subscribe(subscribers)
  promise.finally(cancel)
  promise.cancel = resolve.bind(null, null)

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

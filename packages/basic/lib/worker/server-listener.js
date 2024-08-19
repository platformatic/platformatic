import { withResolvers } from '@platformatic/utils'
import { tracingChannel } from 'node:diagnostics_channel'

export function createServerListener () {
  const { promise, resolve, reject } = withResolvers()

  const subscribers = {
    asyncStart ({ options }) {
      options.port = 0
    },
    asyncEnd ({ server }) {
      resolve(server)
    },
    error (error) {
      cancel()
      reject(error)
    },
  }

  function cancel () {
    tracingChannel('net.server.listen').unsubscribe(subscribers)
  }

  tracingChannel('net.server.listen').subscribe(subscribers)
  promise.finally(cancel)
  promise.cancel = resolve.bind(null, null)

  return promise
}

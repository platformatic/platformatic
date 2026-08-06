import { getEvents } from '@platformatic/globals'
import { subscribe, tracingChannel, unsubscribe } from 'node:diagnostics_channel'

export function createServerListener () {
  const { promise, resolve, reject } = Promise.withResolvers()

  let completed = false
  const subscribers = {
    asyncStart ({ options }) {
      // Unix socket, do nothing
      if (options.path) {
        return
      }

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

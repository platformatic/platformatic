import { getEvents, getMessaging, registerCloseCallback } from '@platformatic/globals'
import { strictEqual } from 'node:assert'
import { setTimeout as sleep } from 'node:timers/promises'

export async function create () {
  const events = getEvents()
  const messaging = getMessaging()
  let closed = false
  registerCloseCallback(async () => {
    strictEqual(closed, true)
    events.emitAndNotify('background:callback')
  })

  messaging.handle({
    ping (payload) {
      return { pong: payload }
    },
    callClient (payload) {
      return messaging.send('loopback-messaging', 'from-target', payload)
    },
    buffer ({ buffer }) {
      return buffer.byteLength
    }
  })

  events.emitAndNotify('create')

  return {
    isBackgroundApplication: true,
    marker: 'factory-background-app',
    async close (app) {
      await sleep(20)
      closed = true
      events.emitAndNotify('close:app', app.marker)
    }
  }
}

export function close () {
  const events = getEvents()
  events.emitAndNotify('close:module')
}

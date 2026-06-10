import { getEvents, getMessaging } from '@platformatic/globals'

export async function create () {
  const events = getEvents()
  const messaging = getMessaging()

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
    close (app) {
      events.emitAndNotify('close:app', app.marker)
    }
  }
}

export function close () {
  const events = getEvents()
  events.emitAndNotify('close:module')
}

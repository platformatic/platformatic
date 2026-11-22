import { getEvents, registerCloseCallback } from '@platformatic/globals'
import { setImmediate } from 'node:timers/promises'

export async function create () {
  const timer = setInterval(() => {}, 1000)
  registerCloseCallback(async () => {
    await setImmediate()
    clearInterval(timer)
    getEvents().emitAndNotify('startup:cleanup', 'callback')
  })
  // Exercise application cleanup rejecting with a non-Error value.
  // eslint-disable-next-line prefer-promise-reject-errors
  registerCloseCallback(() => Promise.reject(null))
  process.once('SIGINT', () => {
    getEvents().emitAndNotify('startup:cleanup', 'signal')
    // A signal listener need not return the asynchronous work it starts.
    setTimeout(() => getEvents().emitAndNotify('startup:cleanup', 'signal:finished'), 3000)
  })
  throw Object.assign(new Error('startup failure'), { code: 'TEST_START_FAILED' })
}

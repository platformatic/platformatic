import { getEvents, registerCloseCallback } from '@platformatic/globals'
import { setTimeout as sleep } from 'node:timers/promises'

export async function create () {
  const timer = setInterval(() => {}, 1000)
  registerCloseCallback(async () => {
    await sleep(20)
    clearInterval(timer)
    getEvents().emitAndNotify('startup:cleanup', 'callback')
  })
  // Exercise application cleanup rejecting with a non-Error value.
  // eslint-disable-next-line prefer-promise-reject-errors
  registerCloseCallback(() => Promise.reject(null))
  process.once('SIGINT', () => getEvents().emitAndNotify('startup:cleanup', 'signal'))
  throw Object.assign(new Error('startup failure'), { code: 'TEST_START_FAILED' })
}

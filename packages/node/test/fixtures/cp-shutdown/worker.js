import { getCapability, getEvents, registerCloseCallback } from '@platformatic/globals'
import { setTimeout as sleep } from 'node:timers/promises'

const events = getEvents()
events.on('stop', () => {
  if (process.env.SHUTDOWN_MODE === 'worker-busy') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0)
  }
  if (process.env.SHUTDOWN_MODE === 'worker-hang') {
    getCapability().stop = () => new Promise(() => {})
  }
  if (process.env.SHUTDOWN_MODE === 'stop-error') {
    throw Object.assign(new Error('stop notification failed'), { code: 'TEST_STOP' })
  }
})
registerCloseCallback(async () => {
  if (process.env.SHUTDOWN_MODE === 'worker-slow') {
    await sleep(1200)
  }
  events.emitAndNotify('shutdown:step', 'worker:callback')
})
process.once('SIGINT', () => {
  events.emitAndNotify('shutdown:step', 'worker:signal')
})

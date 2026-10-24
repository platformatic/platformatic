import { getITC, registerCloseCallback } from '@platformatic/globals'
import { strictEqual } from 'node:assert'

const itc = getITC()
const release = Promise.withResolvers()
const interval = setInterval(() => {}, 1000)
const order = []
itc.handle('release', () => release.resolve())

registerCloseCallback(async () => {
  order.push('first')
  process.once('SIGINT', function (signal) {
    strictEqual(this, process)
    strictEqual(signal, 'SIGINT')
    order.push('signal')
    clearInterval(interval)
    if (process.argv.includes('--delayed-signal')) {
      setTimeout(() => {
        order.push('signal:finished')
        itc.notify('finished', order)
      }, 3000)
      return
    }
    itc.notify('finished', order)
    if (process.argv.includes('--fail')) {
      throw Object.assign(new Error('signal failed'), { code: 'TEST_SIGNAL' })
    }
  })
})
registerCloseCallback(async () => {
  order.push('second:start')
  itc.notify('cleanup:started')
  await release.promise
  order.push('second:end')
  if (process.argv.includes('--fail')) {
    throw Object.create(null)
  }
})
itc.notify('ready')

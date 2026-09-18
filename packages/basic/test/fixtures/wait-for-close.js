import { getITC, registerCloseCallback } from '@platformatic/globals'
const interval = setInterval(() => {
  // No-op
}, 1000)

registerCloseCallback(() => {
  clearInterval(interval)
  throw new Error('FAILURE')
})

const itc = getITC()
itc.notify('ready')

import { getEvents, getITC } from '@platformatic/globals'
const interval = setInterval(() => {
  // No-op
}, 1000)

const events = getEvents()
events.on('close', () => {
  clearInterval(interval)
  throw new Error('FAILURE')
})

const itc = getITC()
itc.notify('ready')

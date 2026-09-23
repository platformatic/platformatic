import { getEvents, getITC, registerCloseCallback } from '@platformatic/globals'
let timeoutId
const events = getEvents()
const itc = getITC()

function doWork () {
  events.emitAndNotify('work')
  timeoutId = setTimeout(doWork, 30_000)
}

itc.on('runtime:event', e => {
  if (e.event === 'background:start') {
    doWork()
  }
})

registerCloseCallback(() => {
  // this and other alike clean ups
  clearTimeout(timeoutId)
})

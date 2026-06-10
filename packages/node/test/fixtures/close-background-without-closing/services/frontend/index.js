import { getEvents, getITC } from '@platformatic/globals'
const events = getEvents()
const itc = getITC()

function doWork () {
  events.emitAndNotify('work')
  setTimeout(doWork, 30_000)
}

itc.on('runtime:event', e => {
  if (e.event === 'background:start') {
    doWork()
  }
})

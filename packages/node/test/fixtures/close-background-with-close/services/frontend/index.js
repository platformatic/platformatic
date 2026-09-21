import { getEvents, getITC } from '@platformatic/globals'
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

export async function close () {
  // this and other alike clean ups
  clearTimeout(timeoutId)

  events.emitAndNotify('close:function')
}

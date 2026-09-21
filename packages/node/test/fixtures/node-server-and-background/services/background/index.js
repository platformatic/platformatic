import { getEvents } from '@platformatic/globals'
function doWork () {
  const events = getEvents()
  events.emitAndNotify('work')
}

const intervalId = setInterval(doWork, 30_000)

export async function close () {
  // this and other alike clean ups
  clearTimeout(intervalId)

  const events = getEvents()
  events.emitAndNotify('close:function')
}

import { getEvents } from '@platformatic/globals'
setTimeout(() => {
  const events = getEvents()
  events.emitAndNotify('argv', import.meta.filename)
}, 1000)

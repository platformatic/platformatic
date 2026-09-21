/* global defineTask */

export default defineTask({
  meta: {
    name: 'smoke',
    description: 'Scheduler integration smoke task'
  },
  run ({ payload }) {
    if (typeof payload.scheduledTime !== 'number') {
      throw new Error('Missing scheduled time')
    }

    return { result: payload.scheduledTime }
  }
})

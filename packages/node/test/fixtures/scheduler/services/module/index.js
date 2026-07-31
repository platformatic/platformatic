import { getEvents } from '@platformatic/globals'

export const scheduledTasks = {
  '0 0 1 1 *': ['moduleTask']
}

export const tasks = {
  moduleTask ({ scheduledTime }) {
    getEvents().emitAndNotify('scheduled:module', scheduledTime)
  }
}

export async function create () {
  return {
    isBackgroundApplication: true
  }
}

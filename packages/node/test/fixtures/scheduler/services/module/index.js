import { getEvents } from '@platformatic/globals'

export const scheduledTasks = {
  '0 0 1 1 *': ['moduleTask']
}

export const tasks = {
  moduleTask ({ scheduledTime, app }) {
    getEvents().emitAndNotify('scheduled:module', scheduledTime, app.isBackgroundApplication)
  }
}

export async function create () {
  return {
    isBackgroundApplication: true
  }
}

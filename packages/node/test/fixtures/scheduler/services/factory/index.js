import { getEvents } from '@platformatic/globals'

export const scheduledTasks = {
  '0 0 1 1 *': ['factoryTask']
}

export const tasks = {
  factoryTask ({ scheduledTime, app }) {
    getEvents().emitAndNotify('scheduled:factory', scheduledTime, app.isBackgroundApplication)
  }
}

export async function create () {
  return {
    isBackgroundApplication: true
  }
}

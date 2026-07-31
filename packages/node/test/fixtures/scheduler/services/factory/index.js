import { getEvents } from '@platformatic/globals'

export const scheduledTasks = {
  '0 0 1 1 *': ['moduleTask']
}

export const tasks = {
  moduleTask () {
    throw new Error('Factory task metadata should take precedence')
  }
}

export async function create () {
  return {
    isBackgroundApplication: true,
    scheduledTasks: {
      '0 0 1 1 *': ['factoryTask']
    },
    tasks: {
      factoryTask ({ scheduledTime }) {
        getEvents().emitAndNotify('scheduled:factory', scheduledTime)
      }
    }
  }
}

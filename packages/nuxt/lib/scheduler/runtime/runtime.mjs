import { getEvents, getITC } from '@platformatic/globals'
import { defineNitroPlugin, runTask, useRuntimeConfig } from '#imports'

const RUN_EVENT = 'platformatic:nuxt:run-scheduled-tasks'
const RUN_HANDLER = 'platformatic:nuxt:run-scheduled-tasks'
const METADATA_NOTIFICATION = 'platformatic:nuxt:scheduled-tasks'

export default defineNitroPlugin(nitroApp => {
  const scheduledTasks = useRuntimeConfig().platformaticScheduler?.scheduledTasks ?? []

  async function runScheduledTasks ({ scheduleId, scheduledTime }) {
    const schedule = scheduledTasks.find(schedule => schedule.id === scheduleId)

    if (!schedule) {
      throw new Error(`Scheduled task group "${scheduleId}" not found`)
    }

    return Promise.all(
      schedule.tasks.map(async name => {
        const { result } = await runTask(name, {
          payload: { scheduledTime },
          context: {}
        })

        return { name, result: result ?? null }
      })
    )
  }

  const itc = getITC({ throwOnMissing: false })

  if (itc && process.env.PLT_MANAGER_ID) {
    itc.handle(RUN_HANDLER, runScheduledTasks)
    itc.notify(METADATA_NOTIFICATION, scheduledTasks)
  }

  const events = getEvents({ throwOnMissing: false })

  if (!events || process.env.PLT_MANAGER_ID) {
    return
  }

  function runHandler ({ scheduleId, scheduledTime, resolve, reject }) {
    runScheduledTasks({ scheduleId, scheduledTime }).then(resolve, reject)
  }

  events.on(RUN_EVENT, runHandler)
  nitroApp.hooks.hook('close', () => events.removeListener(RUN_EVENT, runHandler))
})

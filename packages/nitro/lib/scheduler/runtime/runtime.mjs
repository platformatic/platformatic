import { getCapability, getITC } from '@platformatic/globals'
import { defineNitroPlugin, runTask, useRuntimeConfig } from 'nitropack/runtime'

const RUN_HANDLER = 'platformatic:nitro:run-scheduled-tasks'
const METADATA_NOTIFICATION = 'platformatic:nitro:scheduled-tasks'

export default defineNitroPlugin(nitroApp => {
  const scheduledTasks = useRuntimeConfig().platformaticScheduler?.scheduledTasks ?? []

  async function runScheduledTasks ({ scheduleId, scheduledTime }) {
    const schedule = scheduledTasks.find(schedule => schedule.id === scheduleId)

    if (!schedule) {
      throw new Error(`Scheduled task group "${scheduleId}" not found`)
    }

    const results = await Promise.allSettled(
      schedule.tasks.map(async name => {
        const { result } = await runTask(name, {
          payload: { scheduledTime },
          context: {}
        })

        return { name, result: result ?? null }
      })
    )

    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Scheduled task group "${scheduleId}" failed`)
    }

    return results.map(result => result.value)
  }

  const itc = getITC({ throwOnMissing: false })

  if (itc && process.env.PLT_MANAGER_ID) {
    itc.handle(RUN_HANDLER, runScheduledTasks)
    itc.notify(METADATA_NOTIFICATION, scheduledTasks)
    return
  }

  const capability = getCapability({ throwOnMissing: false })

  if (!capability) {
    return
  }

  capability.setScheduledTasksRunner(runScheduledTasks)
  nitroApp.hooks.hook('close', () => capability.setScheduledTasksRunner(null))
})

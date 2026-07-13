import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeScheduledTasks,
  SCHEDULER_MANIFEST_FILENAME,
  SCHEDULER_MANIFEST_VERSION
} from '../scheduled-tasks.js'

const runtimeDirectory = fileURLToPath(new URL('./runtime', import.meta.url))

export { SCHEDULER_MANIFEST_FILENAME }

export default function schedulerModule (_options, nuxt) {
  let scheduledTasks = []

  nuxt.hook('nitro:config', nitroConfig => {
    scheduledTasks = normalizeScheduledTasks(nitroConfig.scheduledTasks)

    nitroConfig.scheduledTasks = []
    nitroConfig.experimental ??= {}
    nitroConfig.experimental.tasks = true

    nitroConfig.runtimeConfig ??= {}
    nitroConfig.runtimeConfig.platformaticScheduler = { scheduledTasks }

    nitroConfig.plugins ??= []
    nitroConfig.plugins.push(join(runtimeDirectory, 'runtime.mjs'))
  })

  nuxt.hook('nitro:init', nitro => {
    nitro.hooks.hook('compiled', async () => {
      /* c8 ignore next 3 */
      if (nitro.options.dev || !nitro.options.output?.serverDir) {
        return
      }

      await writeFile(
        join(nitro.options.output.serverDir, SCHEDULER_MANIFEST_FILENAME),
        JSON.stringify({ version: SCHEDULER_MANIFEST_VERSION, scheduledTasks }, null, 2)
      )
    })
  })
}

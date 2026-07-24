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

export default function schedulerModule (nitro) {
  const scheduledTasks = normalizeScheduledTasks(nitro.options.scheduledTasks)

  nitro.options.scheduledTasks = {}
  nitro.options.experimental ??= {}
  nitro.options.experimental.tasks = true

  nitro.options.runtimeConfig ??= {}
  nitro.options.runtimeConfig.platformaticScheduler = { scheduledTasks }

  nitro.options.plugins ??= []
  const runtimePlugin = nitro.meta?.majorVersion >= 3 ? 'runtime-nitro.mjs' : 'runtime.mjs'
  nitro.options.plugins.push(join(runtimeDirectory, runtimePlugin))

  nitro.hooks.hook('compiled', async () => {
    if (nitro.options.dev || !nitro.options.output?.serverDir) {
      return
    }

    await writeFile(
      join(nitro.options.output.serverDir, SCHEDULER_MANIFEST_FILENAME),
      JSON.stringify({ version: SCHEDULER_MANIFEST_VERSION, scheduledTasks }, null, 2)
    )
  })
}

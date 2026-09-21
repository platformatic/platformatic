import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const SCHEDULER_MANIFEST_FILENAME = 'platformatic-scheduler.json'
export const SCHEDULER_MANIFEST_VERSION = 1

export class UnsupportedSchedulerManifestVersionError extends Error {
  constructor (version) {
    super(`Unsupported Nitro scheduler manifest version "${version}"`)
    this.code = 'PLT_NITRO_UNSUPPORTED_SCHEDULER_MANIFEST_VERSION'
  }
}

export function normalizeScheduledTasks (scheduledTasks) {
  let schedules = []

  if (Array.isArray(scheduledTasks)) {
    schedules = scheduledTasks
  } else if (scheduledTasks && typeof scheduledTasks === 'object') {
    schedules = Object.entries(scheduledTasks).map(([cron, tasks]) => ({ cron, tasks }))
  }

  return schedules.map(({ cron, tasks }, index) => ({
    id: String(index),
    cron,
    tasks: Array.isArray(tasks) ? tasks : [tasks]
  }))
}

export async function readSchedulerManifest (outputDirectory) {
  let manifest

  try {
    manifest = JSON.parse(
      await readFile(join(outputDirectory, 'server', SCHEDULER_MANIFEST_FILENAME), 'utf8')
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }

    throw error
  }

  if (manifest.version !== SCHEDULER_MANIFEST_VERSION || !Array.isArray(manifest.scheduledTasks)) {
    throw new UnsupportedSchedulerManifestVersionError(manifest.version)
  }

  return manifest.scheduledTasks
}

import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  normalizeScheduledTasks,
  readSchedulerManifest,
  SCHEDULER_MANIFEST_FILENAME
} from '../lib/scheduled-tasks.js'

test('normalizeScheduledTasks preserves groups and assigns deterministic ids', () => {
  deepStrictEqual(normalizeScheduledTasks({
    '*/5 * * * *': 'sync',
    '0 * * * *': ['a', 'b']
  }), [
    { id: '0', cron: '*/5 * * * *', tasks: ['sync'] },
    { id: '1', cron: '0 * * * *', tasks: ['a', 'b'] }
  ])

  deepStrictEqual(normalizeScheduledTasks([
    { cron: '* * * * *', tasks: 'log' }
  ]), [
    { id: '0', cron: '* * * * *', tasks: ['log'] }
  ])
})

test('readSchedulerManifest reads a versioned manifest', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'plt-nitro-scheduler-'))
  const serverDirectory = join(outputDirectory, 'server')
  const scheduledTasks = [{ id: '0', cron: '* * * * *', tasks: ['log'] }]
  await mkdir(serverDirectory)
  await writeFile(
    join(serverDirectory, SCHEDULER_MANIFEST_FILENAME),
    JSON.stringify({ version: 1, scheduledTasks })
  )

  deepStrictEqual(await readSchedulerManifest(outputDirectory), scheduledTasks)
})

test('readSchedulerManifest returns no schedules without module output', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'plt-nitro-scheduler-'))
  deepStrictEqual(await readSchedulerManifest(outputDirectory), [])
})

test('readSchedulerManifest rejects unsupported manifests', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'plt-nitro-scheduler-'))
  const serverDirectory = join(outputDirectory, 'server')
  await mkdir(serverDirectory)
  await writeFile(
    join(serverDirectory, SCHEDULER_MANIFEST_FILENAME),
    JSON.stringify({ version: 2, scheduledTasks: [] })
  )

  await rejects(readSchedulerManifest(outputDirectory), error => {
    strictEqual(error.code, 'PLT_NITRO_UNSUPPORTED_SCHEDULER_MANIFEST_VERSION')
    strictEqual(error.message, 'Unsupported Nitro scheduler manifest version "2"')
    return true
  })
})

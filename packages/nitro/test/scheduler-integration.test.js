import { deepStrictEqual, equal } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../../basic/test/helper.js'

test('executes a Nitro scheduled task through the Watt scheduler', async t => {
  const { runtime } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/scheduler'),
    build: true,
    production: true
  })

  const jobs = runtime.getSchedulerJobs()
  equal(jobs.length, 1)
  deepStrictEqual(jobs[0].tasks, ['smoke'])
  equal(jobs[0].source, 'application')

  const result = await runtime.runSchedulerJob(jobs[0].name)
  equal(result.success, true)
})

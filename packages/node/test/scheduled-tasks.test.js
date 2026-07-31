import { deepStrictEqual, equal } from 'node:assert'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../../basic/test/helper.js'

test('executes scheduled tasks exported by Node applications', async t => {
  const { runtime } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/scheduler')
  })

  const jobs = runtime.getSchedulerJobs()
  equal(jobs.length, 2)

  const moduleJob = jobs.find(job => job.applicationId === 'module')
  const factoryJob = jobs.find(job => job.applicationId === 'factory')
  deepStrictEqual(moduleJob.tasks, ['moduleTask'])
  deepStrictEqual(factoryJob.tasks, ['factoryTask'])

  const moduleExecution = once(runtime, 'application:worker:event:scheduled:module')
  const factoryExecution = once(runtime, 'application:worker:event:scheduled:factory')
  const moduleResult = await runtime.runSchedulerJob(moduleJob.name)
  const factoryResult = await runtime.runSchedulerJob(factoryJob.name)
  const [[moduleScheduledTime], [factoryScheduledTime]] = await Promise.all([moduleExecution, factoryExecution])

  equal(moduleResult.success, true)
  equal(factoryResult.success, true)
  equal(typeof moduleScheduledTime, 'number')
  equal(typeof factoryScheduledTime, 'number')
})

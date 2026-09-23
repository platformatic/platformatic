import { equal, ok, throws } from 'node:assert'
import { test } from 'node:test'
import { SchedulerService } from '../lib/scheduler.js'

test('should execute application jobs without exposing their executor', async t => {
  const calls = []
  const logger = { info () {}, error () {} }
  const scheduler = new SchedulerService(logger)
  scheduler.start()
  t.after(() => scheduler.stop())

  const job = scheduler.addJob(
    {
      name: 'frontend:0',
      cron: '0 0 1 1 *',
      source: 'application',
      applicationId: 'frontend',
      scheduleId: '0',
      tasks: ['cleanup']
    },
    execution => calls.push(execution)
  )

  equal(job.source, 'application')
  equal('executor' in job, false)
  equal('cronJob' in job, false)

  await scheduler.pauseJob(job.name)
  const result = await scheduler.runJob(job.name)

  equal(result.success, true)
  equal(calls.length, 1)
  equal(typeof calls[0].scheduledTime, 'number')
})

test('should reject duplicate scheduler job names', () => {
  const logger = { info () {}, error () {} }
  const scheduler = new SchedulerService(logger)
  const config = { name: 'duplicate', cron: '0 0 1 1 *', source: 'application' }

  scheduler.addJob(config, async () => {})

  throws(() => scheduler.addJob(config, async () => {}), { code: 'PLT_RUNTIME_DUPLICATE_SCHEDULER_JOB' })
})

test('should stop application jobs without changing external pause state', async t => {
  const logger = { info () {}, error () {} }
  const scheduler = new SchedulerService(logger)
  scheduler.start()
  t.after(() => scheduler.stop())

  scheduler.addJob(
    {
      name: 'frontend:0',
      cron: '0 0 1 1 *',
      applicationId: 'frontend'
    },
    async () => {}
  )

  ok(scheduler.getJobs()[0].nextRunAt)
  await scheduler.stopApplicationJobs('frontend')

  const [job] = scheduler.getJobs()
  equal(job.paused, false)
  equal(job.nextRunAt, null)
})

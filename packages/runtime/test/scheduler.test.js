import { strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import { SchedulerService } from '../lib/scheduler.js'

function createScheduler () {
  return new SchedulerService({ info () {}, error () {} })
}

test('should reject invalid cron expressions with a coded error', () => {
  const scheduler = createScheduler()

  throws(() => {
    scheduler.addJob({ name: 'test', cron: 'BOOM!', source: 'application' }, async () => {})
  }, {
    code: 'PLT_RUNTIME_INVALID_SCHEDULER_CRON',
    message: 'Invalid cron expression "BOOM!" for scheduler "test"'
  })
})

test('should execute application scheduler jobs through their executor', async t => {
  const calls = []
  const scheduler = createScheduler()
  scheduler.start()
  t.after(() => scheduler.stop())

  scheduler.addJob(
    {
      name: 'test',
      cron: '0 0 1 1 *',
      source: 'application',
      applicationId: 'app',
      scheduleId: '0',
      tasks: ['task']
    },
    async execution => calls.push(execution)
  )

  const result = await scheduler.runJob('test')

  strictEqual(result.success, true)
  strictEqual(calls.length, 1)
  strictEqual(typeof calls[0].scheduledTime, 'number')
})

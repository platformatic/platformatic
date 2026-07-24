import Fastify from 'fastify'
import { deepStrictEqual, equal, ok, strictEqual, throws } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { transform } from '../lib/config.js'
import { SchedulerService } from '../lib/scheduler.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function createRuntimeWithScheduler (t, scheduler, { managementApi = false } = {}) {
  const configFile = join(fixturesDir, 'scheduler', 'platformatic.json')

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.scheduler = scheduler

      if (managementApi) {
        config.managementApi = true
      }

      return config
    }
  })

  t.after(() => app.close())
  await app.init()

  return app
}

function createTarget (t) {
  const target = Fastify()
  const calls = []
  const executionWaiters = []

  target.route({
    method: ['GET', 'POST'],
    url: '/test',
    handler: async () => {
      calls.push(Date.now())
      executionWaiters.shift()?.()
      return { ok: true }
    }
  })

  t.after(() => target.close())

  return {
    target,
    calls,
    waitForExecution () {
      return new Promise(resolve => executionWaiters.push(resolve))
    }
  }
}

test('should list the configured scheduler jobs', async t => {
  const { target, calls } = createTarget(t)
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    { name: 'test', cron: '*/1 * * * * *', callbackUrl, method: 'GET' },
    { name: 'disabled', cron: '*/1 * * * * *', callbackUrl, method: 'GET', enabled: false }
  ])

  const jobs = await app.getSchedulerJobs()

  // Disabled jobs are not registered at all
  equal(jobs.length, 1)
  equal(jobs[0].name, 'test')
  equal(jobs[0].cron, '*/1 * * * * *')
  equal(jobs[0].callbackUrl, callbackUrl)
  equal(jobs[0].method, 'GET')
  equal(jobs[0].source, 'config')
  equal(jobs[0].paused, false)
  ok(jobs[0].nextRunAt, 'should expose the next run time')
  ok(calls.length >= 0)
})

test('should pause and resume a scheduler job', async t => {
  const { target, calls, waitForExecution } = createTarget(t)
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`
  const firstExecution = waitForExecution()

  const app = await createRuntimeWithScheduler(t, [
    { name: 'test', cron: '*/1 * * * * *', callbackUrl, method: 'GET' }
  ])

  await firstExecution

  await app.pauseSchedulerJob('test')
  const jobs = await app.getSchedulerJobs()
  equal(jobs[0].paused, true)
  equal(jobs[0].nextRunAt, null)

  const callsAfterPause = calls.length
  const resumedExecution = waitForExecution()
  await app.resumeSchedulerJob('test')
  const resumedJobs = await app.getSchedulerJobs()
  equal(resumedJobs[0].paused, false)
  await resumedExecution

  ok(calls.length > callsAfterPause, 'should execute the job after resuming')
})

test('should run a scheduler job on demand, even when paused', async t => {
  const { target, calls } = createTarget(t)
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(t, [
    // Every year, it will never fire during the test
    { name: 'test', cron: '0 0 1 1 *', callbackUrl, method: 'GET' }
  ])

  await app.pauseSchedulerJob('test')
  equal(calls.length, 0)

  const result = await app.runSchedulerJob('test')
  equal(result.success, true)
  equal(result.name, 'test')
  equal(calls.length, 1)

  const jobs = await app.getSchedulerJobs()
  equal(jobs[0].lastStatus, 'success')
  ok(jobs[0].lastExecutedAt)
})

test('should expose the scheduler over the management API', async t => {
  const { target, calls } = createTarget(t)
  await target.listen({ port: 0 })
  const callbackUrl = `http://localhost:${target.server.address().port}/test`

  const app = await createRuntimeWithScheduler(
    t,
    [{ name: 'test', cron: '0 0 1 1 *', callbackUrl, method: 'GET' }],
    { managementApi: true }
  )

  await app.start()

  const client = new Client(
    { hostname: 'localhost', protocol: 'http:' },
    { socketPath: app.getManagementApiUrl(), keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }
  )

  t.after(() => client.close())

  {
    const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/scheduler' })
    strictEqual(statusCode, 200)
    const { jobs } = await body.json()
    equal(jobs.length, 1)
    equal(jobs[0].name, 'test')
    equal(jobs[0].paused, false)
  }

  {
    const { statusCode, body } = await client.request({ method: 'POST', path: '/api/v1/scheduler/test/pause' })
    strictEqual(statusCode, 200)
    const job = await body.json()
    equal(job.paused, true)
  }

  {
    const { statusCode, body } = await client.request({ method: 'POST', path: '/api/v1/scheduler/test/run' })
    strictEqual(statusCode, 200)
    const result = await body.json()
    deepStrictEqual(result.success, true)
    equal(calls.length, 1)
  }

  {
    const { statusCode, body } = await client.request({ method: 'POST', path: '/api/v1/scheduler/test/resume' })
    strictEqual(statusCode, 200)
    const job = await body.json()
    equal(job.paused, false)
  }

  {
    const { statusCode } = await client.request({ method: 'POST', path: '/api/v1/scheduler/missing/pause' })
    strictEqual(statusCode, 404)
  }
})

test('should execute application jobs without exposing their executor', async t => {
  const calls = []
  const logger = { info () {}, error () {} }
  const scheduler = new SchedulerService([], null, logger)
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
  const scheduler = new SchedulerService([], null, logger)
  const config = { name: 'duplicate', cron: '0 0 1 1 *', callbackUrl: 'http://example.com', method: 'GET' }

  scheduler.addJob(config)

  throws(() => scheduler.addJob(config), { code: 'PLT_RUNTIME_DUPLICATE_SCHEDULER_JOB' })
})

test('should stop application jobs without changing external pause state', async t => {
  const logger = { info () {}, error () {} }
  const scheduler = new SchedulerService([], null, logger)
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

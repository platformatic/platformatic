import { CronJob, validateCronExpression } from 'cron'
import { setTimeout } from 'node:timers/promises'
import { request } from 'undici'
import { DuplicateSchedulerJobError, SchedulerJobNotFoundError } from './errors.js'

export class SchedulerService {
  constructor (schedulerConfig, dispatcher, logger) {
    this.logger = logger
    this.dispatcher = dispatcher
    this.jobs = new Map()
    this.started = false

    for (const config of schedulerConfig) {
      this.addJob({ ...config, source: 'config' })
    }
  }

  addJob (config, executor) {
    // Skip disabled schedulers
    if (config.enabled === false) {
      return null
    }

    // Validate cron expression
    const validation = validateCronExpression(config.cron)
    if (!validation.valid) {
      throw new Error(`Invalid cron expression "${config.cron}" for scheduler "${config.name}"`)
    }

    // Set defaults for optional fields
    const job = {
      ...config,
      headers: config.headers || {},
      body: config.body || {},
      maxRetries: config.maxRetries ?? 3,
      source: config.source ?? 'application',
      paused: false,
      lastExecutedAt: null,
      lastStatus: null,
      cronJob: null,
      executor
    }

    if (this.jobs.has(job.name)) {
      throw new DuplicateSchedulerJobError(job.name)
    }

    this.jobs.set(job.name, job)

    if (this.started) {
      this.#startJob(job)
    }

    return this.#serializeJob(job)
  }

  start () {
    this.started = true

    for (const job of this.jobs.values()) {
      this.#startJob(job)
    }
  }

  async stop () {
    this.started = false

    for (const job of this.jobs.values()) {
      await this.#stopJob(job)
    }
  }

  getJobs () {
    return Array.from(this.jobs.values(), job => this.#serializeJob(job))
  }

  // Stops the local cron trigger for a job without removing its configuration.
  // Used when an external coordinator (e.g. ICC) takes over the scheduling, so
  // that multiple instances of the same runtime do not execute the job concurrently.
  async pauseJob (name) {
    const job = this.#getJobOrThrow(name)

    if (job.paused) {
      return this.#serializeJob(job)
    }

    job.paused = true
    await this.#stopJob(job)
    this.logger.info(`Scheduler "${name}" paused`)
    return this.#serializeJob(job)
  }

  async resumeJob (name) {
    const job = this.#getJobOrThrow(name)

    if (!job.paused) {
      return this.#serializeJob(job)
    }

    job.paused = false

    if (this.started) {
      this.#startJob(job)
    }

    this.logger.info(`Scheduler "${name}" resumed`)
    return this.#serializeJob(job)
  }

  async removeApplicationJobs (applicationId) {
    for (const [name, job] of this.jobs) {
      if (job.applicationId === applicationId) {
        await this.#stopJob(job)
        this.jobs.delete(name)
      }
    }
  }

  async stopApplicationJobs (applicationId) {
    for (const job of this.jobs.values()) {
      if (job.applicationId === applicationId) {
        await this.#stopJob(job)
      }
    }
  }

  // Executes a job immediately, regardless of its cron schedule or paused state.
  // Used by an external coordinator to trigger the execution in this instance.
  async runJob (name) {
    const job = this.#getJobOrThrow(name)
    return this.executeCallback(job)
  }

  #getJobOrThrow (name) {
    const job = this.jobs.get(name)
    if (!job) {
      throw new SchedulerJobNotFoundError(name)
    }
    return job
  }

  #startJob (job) {
    if (job.cronJob || job.paused) {
      return
    }

    this.logger.info(`Configuring scheduler "${job.name}" with cron "${job.cron}"`)
    job.cronJob = CronJob.from({
      cronTime: job.cron,
      onTick: async () => {
        this.logger.info(`Executing scheduler "${job.name}"`)
        // This cannot throw, the try/catch is inside
        await this.executeCallback(job)
      },
      start: true,
      timeZone: 'UTC',
      waitForCompletion: true
    })
  }

  async #stopJob (job) {
    if (!job.cronJob) {
      return
    }

    await job.cronJob.stop()
    job.cronJob = null
  }

  async executeCallback (scheduler) {
    let attempt = 0
    let success = false
    const scheduledTime = Date.now()

    while (!success && attempt < scheduler.maxRetries) {
      try {
        const delay = attempt > 0 ? 100 * Math.pow(2, attempt) : 0

        if (delay > 0) {
          this.logger.info(
            `Retrying scheduler "${scheduler.name}" in ${delay}ms (attempt ${attempt + 1}/${scheduler.maxRetries})`
          )
          await setTimeout(delay)
        }
        if (scheduler.executor) {
          await scheduler.executor({ scheduledTime })
        } else {
          const headers = {
            'x-retry-attempt': attempt + 1,
            ...scheduler.headers
          }

          const bodyString = typeof scheduler.body === 'string' ? scheduler.body : JSON.stringify(scheduler.body)
          const response = await request(scheduler.callbackUrl, {
            method: scheduler.method,
            headers,
            body: bodyString,
            dispatcher: this.dispatcher
          })

          // Consume the body to release the connection.
          await response.body.dump()

          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`HTTP error ${response.statusCode}`)
          }
        }

        this.logger.info(`Scheduler "${scheduler.name}" executed successfully`)
        success = true
      } catch (error) {
        this.logger.error(
          `Error executing scheduler "${scheduler.name}" (attempt ${attempt + 1}/${scheduler.maxRetries}):`,
          error.message
        )
        attempt++
      }
    }

    scheduler.lastExecutedAt = new Date().toISOString()
    scheduler.lastStatus = success ? 'success' : 'failed'

    if (!success) {
      this.logger.error(`Scheduler "${scheduler.name}" failed after ${scheduler.maxRetries} attempts`)
    }

    return { name: scheduler.name, success, executedAt: scheduler.lastExecutedAt }
  }

  #serializeJob (job) {
    const { cronJob, executor, ...serializable } = job
    let nextRunAt = null

    if (cronJob) {
      try {
        nextRunAt = cronJob.nextDate().toJSDate().toISOString()
        /* c8 ignore next 3 */
      } catch {
        nextRunAt = null
      }
    }

    return { ...serializable, nextRunAt }
  }
}

export function startScheduler (config, interceptors, logger) {
  const schedulerService = new SchedulerService(config, interceptors, logger)
  schedulerService.start()
  return schedulerService
}

import { CronJob, validateCronExpression } from 'cron'
import { setTimeout } from 'node:timers/promises'
import { request } from 'undici'

export class SchedulerService {
  constructor (schedulerConfig, dispatcher, logger) {
    this.logger = logger
    this.jobsConfig = []
    this.cronJobs = []
    this.dispatcher = dispatcher
    this.validateCronSchedulers(schedulerConfig)
  }

  validateCronSchedulers (schedulerConfig) {
    for (const config of schedulerConfig) {
      // Skip disabled schedulers
      if (config.enabled === false) {
        continue
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
        maxRetries: config.maxRetries || 3
      }
      this.jobsConfig.push(job)
    }
  }

  start () {
    for (const job of this.jobsConfig) {
      this.logger.info(`Configuring scheduler "${job.name}" with cron "${job.cron}"`)
      const cronJob = CronJob.from({
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

      this.cronJobs.push(cronJob)
    }
  }

  async stop () {
    for (const job of this.cronJobs) {
      await job.stop()
    }
  }

  async executeCallback (scheduler) {
    let attempt = 0
    let success = false

    while (!success && attempt < scheduler.maxRetries) {
      try {
        const delay = attempt > 0 ? 100 * Math.pow(2, attempt) : 0

        if (delay > 0) {
          this.logger.info(
            `Retrying scheduler "${scheduler.name}" in ${delay}ms (attempt ${attempt + 1}/${scheduler.maxRetries})`
          )
          await setTimeout(delay)
        }
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

        // Consumes the body, but we are not interested in the body content,
        // we don't save it anywere, so we just dump it
        await response.body.dump()

        if (response.statusCode >= 200 && response.statusCode < 300) {
          this.logger.info(`Scheduler "${scheduler.name}" executed successfully`)
          success = true
        } else {
          throw new Error(`HTTP error ${response.statusCode}`)
        }
      } catch (error) {
        this.logger.error(
          `Error executing scheduler "${scheduler.name}" (attempt ${attempt + 1}/${scheduler.maxRetries}):`,
          error.message
        )
        attempt++
      }
    }

    if (!success) {
      this.logger.error(`Scheduler "${scheduler.name}" failed after ${scheduler.maxRetries} attempts`)
    }
  }
}

export function startScheduler (config, interceptors, logger) {
  const schedulerService = new SchedulerService(config, interceptors, logger)
  schedulerService.start()
  return schedulerService
}

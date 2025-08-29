async function scheduler (app, _opts) {
  async function sendSchedulerInfo () {
    // Skip scheduler configuration if ICC is not configured
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping scheduler configuration')
      return
    }

    try {
      const applicationId = app.instanceConfig?.applicationId
      const runtime = app.wattpro.runtime
      const config = await runtime.getRuntimeConfig()
      const { default: build, setDefaultHeaders } = await import('../clients/cron/cron.mjs')

      const cronUrl = app.instanceConfig?.iccServices?.cron?.url
      if (!cronUrl) {
        app.log.warn('No cron URL found in ICC services')
        return
      }
      const cronClient = build(cronUrl)
      setDefaultHeaders(await app.getAuthorizationHeader())

      const jobs = config.scheduler || []

      const saveJobs = []
      for (const job of jobs) {
        const iccJob = { ...job, applicationId }
        iccJob.schedule = iccJob.cron // unfortunately, the ICC API uses `schedule` instead of `cron`
        delete iccJob.cron
        delete iccJob.enabled
        saveJobs.push(cronClient.putWattJobs(iccJob))
      }
      const result = await Promise.allSettled(saveJobs)
      const errors = result.filter((job) => job.status === 'rejected')
      if (errors.length > 0) {
        app.log.error(errors, 'Failed to save jobs in ICC')
        throw new AggregateError('Failed to save jobs in ICC', { cause: errors.map(job => job.reason) })
      }

      app.log.info('Scheduler configured')
    } catch (error) {
      app.log.error(error, 'Failed in configuring watt jobs in ICC')
    }
  }
  app.sendSchedulerInfo = sendSchedulerInfo
}

export default scheduler

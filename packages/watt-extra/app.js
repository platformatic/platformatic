import avvio from 'avvio'
import { setTimeout } from 'node:timers/promises'
import init from './plugins/init.js'
import env from './plugins/env.js'
import metadata from './plugins/metadata.js'
import compliancy from './plugins/compliancy.js'
import scheduler from './plugins/scheduler.js'
import auth from './plugins/auth.js'
import update from './plugins/update.js'
import alert from './plugins/alerts.js'

async function buildApp (logger) {
  const app = {
    log: logger
  }

  avvio(app)

  app.use(env)
    .use(auth)
    .use(init)
    .use(alert)
    .use(metadata)
    .use(compliancy)
    .use(scheduler)
    .use(update)

  await app.ready()

  app.startRuntime = async function startRuntime () {
    app.log.info('Starting Runtime')
    try {
      app.log.info('Spawning the app')
      await app.wattpro.spawn()
    } catch (err) {
      app.log.error(err, 'Failed to spawn the app')
      throw new Error('Failed to spawn the app: ' + err.message)
    }
  }

  app.sendToICC = async function sendToICC () {
    // Skip if ICC is not configured
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping ICC operations')
      return
    }

    if (!app.wattpro.runtime) {
      throw new Error('Runtime not started, cannot send to ICC')
    }
    try {
      if (!app.instanceConfig) {
        await app.initApplication()
      }
      await app.connectToUpdates()
      await app.sendMetadata()
      await app.checkCompliancy()
      await app.sendSchedulerInfo()
    } catch (err) {
      app.log.error({ err }, 'Failed in sending data to ICC')
      throw err
    }
  }

  app.sendToICCWithRetry = async function sendToICCWithRetry () {
    // Skip all ICC operations if PLT_ICC_URL is not set
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping all ICC operations')
      return
    }

    const baseRetryInterval = Number(app.env.PLT_ICC_RETRY_TIME)
    const maxRetryInterval = 60000 // Max retry interval: 1 minute

    let currentRetryInterval = baseRetryInterval
    let retries = 0
    let capReached = false

    while (true) { // Continue indefinitely
      retries++

      try {
        await this.sendToICC()
        logger.info('Successfully sent info to ICC after retry')
        return
      } catch (err) {
        if (!capReached) {
          const waitFor = 200 * Math.pow(2, retries)
          if (waitFor >= maxRetryInterval) {
            capReached = true
            currentRetryInterval = maxRetryInterval
          } else {
            currentRetryInterval = waitFor
          }
        }
        logger.error({
          err: err.message,
          attemptNumber: retries,
          nextRetryMs: currentRetryInterval
        }, `Failed to send info to ICC, retrying in ${currentRetryInterval}ms`)
        await setTimeout(currentRetryInterval)
      }
    }
  }

  app.close = async function close () {
    app.log.info('Closing runtime')
    if (app.wattpro.runtime) {
      await app.wattpro.close()
    }
    await app.closeUpdates()
  }

  return app
}

export default buildApp

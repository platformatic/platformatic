import buildApp from './app.js'
import pino from 'pino'
import { fileURLToPath } from 'node:url'

const logger = pino({
  level: process.env.PLT_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true
    }
  }
})

// This starts the app and sends the info to ICC, so it's the main entry point
async function start () {
  const app = await buildApp(logger)

  app.log.info('Starting Runtime')
  await app.startRuntime()

  app.log.info('Setup health check')
  await app.setupAlerts()

  app.log.info('Sending info to ICC')
  await app.sendToICCWithRetry()
  return app
}

// Check if this file is being run directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url)

if (isMain) {
  start().catch(err => {
    console.error(`Failed to start application: ${err.message}`)
    process.exit(1)
  })
}

export {
  start,
  logger
}

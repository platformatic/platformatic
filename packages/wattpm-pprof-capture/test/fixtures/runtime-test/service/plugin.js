'use strict'

const { setTimeout: sleep } = require('node:timers/promises')
const atomicSleep = require('atomic-sleep')

module.exports = async function (app) {
  // Simple hello world service
  app.get('/', async () => {
    return { message: 'Hello World' }
  })

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  app.post('/cpu-intensive', async (req) => {
    // Simulate a CPU intensive operation
    const timeout = parseInt(req.query.timeout || 1000)

    const interval = setInterval(async () => {
      atomicSleep(900)
      await sleep(100)
    }, 1000)

    await sleep(timeout)
    clearInterval(interval)

    return { status: 'ok' }
  })
}

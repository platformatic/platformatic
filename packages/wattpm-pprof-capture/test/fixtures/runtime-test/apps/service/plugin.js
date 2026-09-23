'use strict'

const atomicSleep = require('atomic-sleep')

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = async function (app) {
  let cpuIntensiveInterval = null

  // Simple hello world service
  app.get('/', async () => {
    return { message: 'Hello World' }
  })

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  // Hard-blocks the event loop for the requested duration, shortly after
  // replying, to simulate a completely unresponsive worker
  app.post('/block', async request => {
    const ms = parseInt(request.query.ms, 10) || 3000
    setTimeout(() => atomicSleep(ms), 100)
    return { message: `Blocking the event loop for ${ms}ms` }
  })

  // CPU intensive endpoint to simulate high ELU
  app.post('/cpu-intensive/start', async () => {
    if (cpuIntensiveInterval) {
      return { message: 'Already running' }
    }

    cpuIntensiveInterval = setInterval(async () => {
      atomicSleep(900) // Blocks the event loop for 900ms
      await sleep(100) // Allows async operations
    }, 1000)

    return { message: 'CPU intensive task started' }
  })

  app.post('/cpu-intensive/stop', async () => {
    if (cpuIntensiveInterval) {
      clearInterval(cpuIntensiveInterval)
      cpuIntensiveInterval = null
      return { message: 'CPU intensive task stopped' }
    }
    return { message: 'Not running' }
  })

  // Clean up on close
  app.addHook('onClose', async () => {
    if (cpuIntensiveInterval) {
      clearInterval(cpuIntensiveInterval)
    }
  })
}

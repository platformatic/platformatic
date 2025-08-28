'use strict'

module.exports = async function (app) {
  // Simple hello world service
  app.get('/', async () => {
    return { message: 'Hello World' }
  })

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' }
  })
}

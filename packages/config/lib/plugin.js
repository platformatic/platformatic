'use strict'

async function configRoutes (app, opts) {
  const { configManager } = opts

  app.get('/config-file', async (req, reply) => {
    const data = configManager.current
    return reply
      .code(200)
      .header('Content-Type', 'application/json')
      .send(data)
  })
  app.decorate('platformaticConfigManager', configManager)
}

module.exports = configRoutes

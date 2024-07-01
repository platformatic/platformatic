'use strict'

const fastify = require('fastify')
const { metaKeys } = require('@platformatic/config')

module.exports = async function (app) {
  // Create a simple fastify server which will mimic an external server
  const external = fastify({ logger: false, keepAliveTimeout: 10, forceCloseConnections: true })

  external.get('/', async () => {
    return { from: 'tcp' }
  })

  await external.listen({ port: 0 })
  app.onClose(() => external.close())

  app.get('/', async (req, res) => {
    return { from: 'beta' }
  })

  app.platformatic.meta[app.platformatic.currentService] = {
    [metaKeys.accessPoint]: `http://127.0.0.1:${external.server.address().port}`
  }
}

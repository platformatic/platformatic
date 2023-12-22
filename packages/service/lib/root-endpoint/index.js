'use strict'

const path = require('path')
const fastifyStatic = require('@fastify/static')
const userAgentParser = require('ua-parser-js')

module.exports = async (app, opts) => {
  const versions = opts.versions || {}

  app.register(fastifyStatic, {
    root: path.join(__dirname, 'public')
  })

  app.route({
    method: 'GET',
    path: '/_platformatic_versions',
    schema: { hide: true },
    handler: () => {
      const openapiUrls = []
      for (const versionConfig of versions?.configs ?? []) {
        const name = versionConfig.version
        const prefix = versionConfig.openapi.prefix
        openapiUrls.push({ name, prefix })
      }
      return openapiUrls
    }
  })

  // root endpoint
  app.route({
    method: 'GET',
    path: '/',
    schema: { hide: true },
    handler: (req, reply) => {
      const uaString = req.headers['user-agent']
      if (uaString) {
        const parsed = userAgentParser(uaString)
        if (parsed.browser.name !== undefined) {
          return reply.sendFile('./index.html')
        }
      }
      return { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }
    }
  })
}

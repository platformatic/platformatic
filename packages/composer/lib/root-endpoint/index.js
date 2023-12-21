'use strict'

const { join } = require('node:path')
const fastifyStatic = require('@fastify/static')
const userAgentParser = require('ua-parser-js')

module.exports = async (app, opts) => {
  app.register(fastifyStatic, {
    root: join(__dirname, 'public')
  })

  app.route({
    method: 'GET',
    path: '/_platformatic_versions',
    schema: { hide: true },
    handler: () => {
      return {
        openapi: opts.composer.services.some(s => s.openapi),
        graphiql: !!(opts.composer.graphql?.graphiql)
      }
    }
  })

  // root endpoint
  app.route({
    method: 'GET',
    path: '/',
    schema: { hide: true },
    handler: (req, reply) => {
      const uaString = req.headers['user-agent']
      console.log('uaString', uaString)
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

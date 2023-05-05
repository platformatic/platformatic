'use strict'

const path = require('path')
const fastifyStatic = require('@fastify/static')
const userAgentParser = require('ua-parser-js')

module.exports = async (app, opts) => {
  app.register(fastifyStatic, {
    root: path.join(__dirname, 'public')
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
      return { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' }
    }
  })
}

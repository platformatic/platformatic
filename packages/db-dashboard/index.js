'use strict'

const fastifyStatic = require('@fastify/static')
const path = require('path')
module.exports = async function app (app, opts) {
  app.log.info('dashboard plugin loaded.')
  if (opts.dashboardAtRoot !== false) {
    app.get('/', { hide: true }, function (req, reply) {
      return reply.redirect(302, '/dashboard')
    })
  }

  app.register(fastifyStatic, {
    root: path.join(__dirname, 'build')
  })

  app.get('/dashboard', { hide: true }, function (req, reply) {
    return reply.sendFile('index.html')
  })
}

'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function (app) {
  app.decorate('foo', 'bar')
})

'use strict'

const fp = require('fastify-plugin')
const autoload = require('@fastify/autoload')

module.exports = fp(async function (app, opts) {
  app.register(autoload, {
    dir: opts.path,
    ...opts
  })
})

'use strict'

const path = require('node:path')

module.exports = async function (app) {
  app.register(require('@fastify/static'), {
    root: path.join(__dirname, 'hello')
  })
}

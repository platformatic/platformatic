'use strict'

// const pltClient = require('@platformatic/client')
const { join } = require('path')

async function plugin () {

}

async function generateWithLoggerClientPlugin (app, opts) {
  app.register(plugin, {
    type: 'openapi',
    name: 'withLogger',
    path: join(__dirname, 'with-logger.openapi.json'),
    url: opts.url
  })
}

generateWithLoggerClientPlugin[Symbol.for('plugin-meta')] = {
  name: 'withLogger OpenAPI Client'
}
generateWithLoggerClientPlugin[Symbol.for('skip-override')] = true

module.exports = generateWithLoggerClientPlugin
module.exports.default = generateWithLoggerClientPlugin

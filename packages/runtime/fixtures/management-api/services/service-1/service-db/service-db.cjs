'use strict'

// const pltClient = require('@platformatic/client')
const { join } = require('path')

async function plugin () {

}

async function generateServiceDbClientPlugin (app, opts) {
  app.register(plugin, {
    type: 'openapi',
    name: 'serviceDb',
    path: join(__dirname, 'with-logger.openapi.json'),
    url: opts.url,
  })
}

generateServiceDbClientPlugin[Symbol.for('plugin-meta')] = {
  name: 'serviceDb OpenAPI Client',
}
generateServiceDbClientPlugin[Symbol.for('skip-override')] = true

module.exports = generateServiceDbClientPlugin
module.exports.default = generateServiceDbClientPlugin

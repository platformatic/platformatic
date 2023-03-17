'use strict'

const pltClient = require('@platformatic/client')
const { join } = require('path')

async function generateHelloClientPlugin (app, opts) {
  app.register(pltClient, {
    type: 'openapi',
    name: 'hello',
    file: join(__dirname, 'hello.openapi.json'),
    url: opts.url
  })
}

generateHelloClientPlugin[Symbol.for('plugin-meta')] = {
  name: 'hello OpenAPI Client'
}
generateHelloClientPlugin[Symbol.for('skip-override')] = true

module.exports = generateHelloClientPlugin
module.exports.default = generateHelloClientPlugin

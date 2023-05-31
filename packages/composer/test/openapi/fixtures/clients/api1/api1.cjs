'use strict'

const pltClient = require('@platformatic/client')
const { join } = require('path')

async function generateApi1ClientPlugin (app, opts) {
  app.register(pltClient, {
    type: 'openapi',
    name: 'api1',
    path: join(__dirname, 'api1.openapi.json'),
    url: opts.url
  })
}

generateApi1ClientPlugin[Symbol.for('plugin-meta')] = {
  name: 'api1 OpenAPI Client'
}
generateApi1ClientPlugin[Symbol.for('skip-override')] = true

module.exports = generateApi1ClientPlugin
module.exports.default = generateApi1ClientPlugin

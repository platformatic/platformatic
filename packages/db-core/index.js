'use strict'

const fp = require('fastify-plugin')
const sqlMapper = require('@platformatic/sql-mapper')

const defaults = [{
  module: '@platformatic/sql-events',
  configKey: 'events'
}, {
  module: '@platformatic/sql-graphql',
  configKey: 'graphql'
}, {
  module: '@platformatic/sql-openapi',
  configKey: 'openapi'
}]

module.exports = fp(async function (app, opts) {
  app.register(sqlMapper, {
    ...opts
  })

  for (const obj of defaults) {
    registerAndConfig(obj)
  }

  function registerAndConfig ({ module, configKey }) {
    if (opts[configKey] !== false) {
      const sqlModule = require(module)
      const config = typeof opts[configKey] === 'object' ? opts[configKey] : {}
      return app.register(sqlModule, {
        ...config
      })
    }
  }
})

module.exports.connect = sqlMapper.connect

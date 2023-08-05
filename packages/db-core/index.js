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
    if (shouldRegister(opts, configKey)) {
      const sqlModule = require(module)
      const config = typeof opts[configKey] === 'object' ? opts[configKey] : {}
      return app.register(sqlModule, {
        ...config
      })
    }
  }
})

function shouldRegister (opts, configKey) {
  const enabledKey = 'enabled'
  const config = opts[configKey]

  // If config is not defined or set to true, default is to register.
  // For example, in addition to `openapi` and `graphql, the `events` config
  // also would be registered since it's not provided.
  //
  // {
  //   "openapi": true,
  //   "graphql": true
  // }
  if (config === undefined || config === true) {
    return true
  }

  // If the top-level key is false or the enabled key is set to false,
  // do not register.
  //
  // {
  //  "openapi": false,
  //  "graphql": {
  //    "enabled": false
  //  },
  // }
  if (config === false || opts[configKey][enabledKey] === false) {
    return false
  }

  // For everything else, register away!
  // {
  //  "graphql": {},
  //  "openapi": {
  //    "enabled": true
  //  },
  //  "events": {
  //    "enabled": "{PLT_EVENTS_ENABLED}"
  //  }
  // }
  return true
}

module.exports.connect = sqlMapper.connect

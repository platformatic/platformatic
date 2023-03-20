'use strict'

const ConfigManager = require('@platformatic/config')
const { schema } = require('./schema')

class ServiceConfigManager extends ConfigManager {
  constructor (opts) {
    super({
      ...opts,
      schema: opts.schema || schema,
      schemaOptions: {
        useDefaults: true,
        coerceTypes: true,
        allErrors: true,
        strict: false
      },
      allowToWatch: ['.env'],
      envWhitelist: ['PORT', ...(opts.envWhitelist || [])]
    })
  }
}

module.exports = ServiceConfigManager

'use strict'

const { ServiceStackable } = require('@platformatic/service')
const { platformaticDatabase } = require('./application')
const { packageJson } = require('./schema')

class DatabaseStackable extends ServiceStackable {
  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'db'
    this.version = packageJson.version
    this.applicationFactory = this.context.applicationFactory ?? platformaticDatabase
  }

  updateContext (context) {
    super.updateContext(context)

    const config = this.configManager.current
    if (this.context.isProduction && config.autogenerate) {
      config.autogenerate = false
      this.configManager.update(config)
    }
  }

  async getMeta () {
    const serviceMeta = await super.getMeta()

    const config = this.configManager.current

    const dbConfig = config.db
    const connectionString = dbConfig?.connectionString

    if (connectionString) {
      return {
        ...serviceMeta,
        connectionStrings: [connectionString]
      }
    }

    return serviceMeta
  }
}

module.exports = { DatabaseStackable }

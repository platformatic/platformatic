'use strict'

const { ServiceStackable } = require('@platformatic/service')

class DbStackable extends ServiceStackable {
  constructor (options) {
    super(options)
    this.#updateConfig()
  }

  #updateConfig () {
    if (!this.context) return

    const { isProduction } = this.context
    const config = this.configManager.current

    if (isProduction) {
      if (config.autogenerate) {
        config.autogenerate = false
      }
    }

    this.configManager.update(config)
  }

  async getMeta () {
    await this.init()
    await this.app.ready()

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
module.exports = { DbStackable }

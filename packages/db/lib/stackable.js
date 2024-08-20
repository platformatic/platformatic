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

  async getDBInfo () {
    await this.init()
    await this.app.ready()
    if (this.app.platformatic.db) {
      const connectionInfo = this.app.platformatic.db.connectionInfo
      const dbschema = this.app.platformatic.dbschema
      return { connectionInfo, dbschema }
    }
    return null
  }
}
module.exports = { DbStackable }

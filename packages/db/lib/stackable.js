'use strict'

const kITC = Symbol.for('plt.runtime.itc')

const { ServiceStackable } = require('@platformatic/service')

class DbStackable extends ServiceStackable {
  constructor (options) {
    super(options)
    this.#updateConfig()
  }

  async init () {
    await super.init()
    const itc = globalThis[kITC]
    if (itc) {
      globalThis[kITC].handle('getServiceMeta', this.getMeta.bind(this))
    }
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

    const config = this.configManager.current

    const dbConfig = config.db
    const connectionString = dbConfig?.connectionString

    if (connectionString) {
      return {
        db: {
          connectionStrings: [connectionString]
        }
      }
    }
    return {}
  }
}
module.exports = { DbStackable }

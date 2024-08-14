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
}
module.exports = { DbStackable }

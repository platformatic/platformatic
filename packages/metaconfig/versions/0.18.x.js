'use strict'

const rfdc = require('rfdc')()

class ZeroEighteen {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version || '0.18.0'
    this.path = path
    this.format = format || 'json'

    if (config.db) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }

  up () {
    const original = this.config
    const config = rfdc(original)
    config.$schema = `https://platformatic.dev/schemas/v0.19.0/${this.kind}`

    const NewClass = require('./0.19.x.js')

    return new NewClass({ config, path: this.path, format: this.format })
  }
}

module.exports = ZeroEighteen

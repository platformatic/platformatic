'use strict'

const rfdc = require('rfdc')()

class ZeroSeventeen {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version || '0.17.0'
    this.path = path
    this.format = format || 'json'

    if (config.core) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }

  up () {
    const original = this.config
    const config = rfdc(original)

    if (this.kind === 'db') {
      config.db = config.core
      delete config.core
    }

    const NewClass = require('./from-zero-eighteen-to-will-see')

    return new NewClass({ config, path: this.path, format: this.format, version: '0.18.0' })
  }
}

module.exports = ZeroSeventeen
